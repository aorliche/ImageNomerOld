import uuid
import json
import requests
import re
import numpy as np
import sys

from imagenomer.power264 import power_rois

'''
ImageNomeR Library

User imports this into their python code, creates an Analysis object, then creates
JsonData, JsonSubjects, or JsonMetadata objects and sends them to the server via .post()

Server then sends them on request to client on the web browser
'''

class JsonBase:
    '''
    Base for JsonData, JsonSubjects, and JsonMetadata

    .update() folds a user-defined dict into the created JSON
    .pack() methods on child classes validate correct fields, and inputting
    values that the json library can't handle will raise an Exception
    '''
    def __init__(self, analysis=None):
        self.analysis = analysis
        self.dict = {}

    def update(self, dct):
        self.dict.update(dct)

class JsonSubjects(JsonBase):
    def __init__(self, analysis):
        super().__init__(analysis)

    def pack(self):
        keys = set(self.dict.keys())
        assert 'IDs' in keys
        assert 'Features' in keys
        assert any(key in keys for key in ['Responses', 'Groups'])
        return json.dumps(self.dict)

    def post(self):
        return self.analysis.postSubjects(self.pack())

'''
Used to graph subject-to-subject or group-to-group similarity
'''
class JsonSimilarity(JsonBase):
    def __init__(self, analysis, data):
        super().__init__(analysis)
        self.data = data

    def pack(self, runid):
        self.dict['runid'] = runid
        keys = set(self.dict.keys())
        assert 'Edges' in keys, 'Must contain Edges list of matrices'
        assert 'From' in keys, 'Must contain From indices'
        assert 'To' in keys, 'Must contain To indices'
        return json.dumps(self.dict)
    
    def post(self):
        runid = self.data.dict['runid']
        return self.analysis.postSimilarity(self.pack(runid), runid)

'''
Send accuracy, train/test split, and weights for an algorithm run to the server
'''
class JsonData(JsonBase):
    def __init__(self, analysis):
        super().__init__(analysis)

    def pack(self, runid):
        self.dict['runid'] = runid
        self.dict['desc'] = self.analysis.desc
        keys = set(self.dict.keys())
        assert any(key in keys for key in ['Accuracy', 'RMSE']), (
            'Must have either Accuracy or RMSE')
        assert 'Train' in keys and 'Test' in keys, (
            'Must have train and test sets')
        assert len(self.dict['Train']) == len(self.dict['Test']), (
            'Must have same number of classes in train and test sets')
        assert 'Weights' in keys, (
            'Must have Weights')
        assert all(len(self.dict['Weights']) == len(lab) for lab in self.analysis.labels), (
            'All label lists must be same length as list')
        if len(self.analysis.prev) > 0:
            assert len(self.analysis.prev[0]['Weights']) == len(self.dict['Weights']), (
                'Number of weights must be same across all runs')
        return json.dumps(self.dict)

    def post(self):
        runid = self.analysis.runid
        if runid == 0:
            self.dict['LabelNames'] = self.analysis.label_names
            self.dict['Labels'] = self.analysis.labels
        return self.analysis.postData(self.pack(runid))

class JsonMetadata(JsonBase):
    def __init__(self, analysis):
        super().__init__(analysis)
        #assert len(analysis.prev) > 0, 'Load a run before adding metadata'

    def post(self):
        return self.analysis.postMetadata(self.pack())

class JsonCommunityMetadata(JsonMetadata):
    '''
    Each feature is a member of one or more communities
    Currently used for feature labels of type 'xxx-xxx' and brain functional networks (DMN, SMH, etc.)
    Contains Template, CommunityMap, and CommunityNames fields (required) 
    Optionally contains CommunityExpected field for brain functional networks
    '''
    def __init__(self, analysis):
        super().__init__(analysis)
    
    def pack(self):
        assert 'CommunityMap' in self.dict, 'Must have CommunityMap'
        assert 'CommunityNames' in self.dict, 'Must have CommunityNames'
        assert 'Template' in self.dict, 'Must have Template'
        return json.dumps(self.dict)

class Analysis:
    '''
    Analysis class holds description of analysis and domain of server
    It also keeps track of the unique analysis ID

    .postData() .postMetadata() and .postSubjects() are called by the .post()
    methods of JsonBase-derived classes
    '''
    instances = []

    def __init__(self, desc='test analysis', label_names=None, labels=None, host='localhost', port=80, kill_others=True):
        assert len(label_names) == len(labels), (
            'label_names must have same length as number of types of labels')
        self.id = uuid.uuid4()
        self.desc = desc
        self.label_names = label_names
        self.labels = labels
        self.host = host
        self.prev = []
        self.runid = 0
        self.subjects = None
        self.port = port
        self.headers = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    
    def postData(self, data):
        url = f'http://{self.host}:{self.port}/post?id={self.id}&runid={self.runid}&type=data'
        r = requests.post(url, headers=self.headers, data=data);
        if r.content.decode() == 'Success':
            self.prev.append(json.loads(data))
            self.runid += 1
        return r

    def postMetadata(self, meta):
        url = f'http://{self.host}:{self.port}/post?id={self.id}&type=metadata'
        r = requests.post(url, headers=self.headers, data=meta);
        return r
    
    def postSimilarity(self, sim, runid):
        url = f'http://{self.host}:{self.port}/post?id={self.id}&runid={runid}&type=similarity'
        r = requests.post(url, headers=self.headers, data=sim);
        return r

    def postSubjects(self, subjects):
        url = f'http://{self.host}:{self.port}/post?id={self.id}&type=subjects'
        r = requests.post(url, headers=self.headers, data=subjects)
        if r.content.decode() == 'Success':
            self.subjects = set(json.loads(subjects))
        return r
    
    def postImage(self, image):
        url = f'http://{self.host}:{self.port}/post?id={self.id}&type=image'
        r = requests.post(url, headers=self.headers, data=image)
        return r
