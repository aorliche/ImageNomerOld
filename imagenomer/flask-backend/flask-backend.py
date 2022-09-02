import json

import sys

from flask import Flask, request, render_template, redirect
from flask import jsonify

import os
import numpy as np

import time

app = Flask(__name__, 
    static_url_path='',
    static_folder=os.path.abspath('static'),
    template_folder=os.path.abspath('templates'))

cache = {}

@app.route('/')
def index():
    items = {}
    for item in cache.values():
        accs = np.array([run['Accuracy'] for run in item['runs']])
        item['acc'] = round(np.mean(accs), 3)
        item['std'] = round(np.std(accs), 3)
    return render_template('index.html', cache=cache)

@app.route('/analyze')
def analyze():
    try:
        args = request.args
        if 'id' not in args:
            return 'id not in query parameters'
        runs = cache[args['id']]['runs'] 
        accuracies = np.array([run['Accuracy'] for run in runs])
        acc = np.mean(accuracies)
        acc = '{:.3f}'.format(acc)
        std = np.std(accuracies)
        std = '{:.3f}'.format(std)
        wLen = min(1000,len(runs[0]['Weights']))
        wStep = int(wLen/100)
        return render_template('analyze.html', cache=cache, id=args['id'], 
            accuracy=acc, stddev=std, wLen=wLen, wStep=wStep, labelNames=runs[0]['LabelNames'])   
    except Exception as e:
        return f'exception: {e}'

'''
@app.route('/clear')
def postClear():
    args = request.args
    if 'id' not in args:
        return 'id not in query parameters'
    _id = args['id']
    if _id in cache:
        if 'runid' in args:
            runid = args['runid']
            for i in range(len(cache[_id]['runs'])):
                if cache[_id]['runs'][i].runid == runid:
                    del cache[_id]['runs'][i]
                    return 'Success'
            return f'runid {runid} not found'
        elif 'metadata' in args:
            del cache[_id]['metadata']
            return 'Success'
        elif 'subjects' in args:
            del cache[_id]['subjects']
            return 'Success'
        else:
            del cache[_id]
            return 'Success'
    else:
        return f'No such id {_id}'
'''

@app.route('/test')
def testData():
    return 'ok'

@app.route('/clear')
def clear():
    try:
        args = request.args
        if 'id' not in args:
            return 'missing id'
        if args['id'] not in cache:
            return 'id not in cache'
        del cache[args['id']]
        return redirect('/', code=302)
    except Exception as e:
        return f'exception: {e}'

@app.route('/post', methods=['POST'])
def post():
    try:
        args = request.args
        if 'type' not in args:
            return 'missing type'
        if 'id' not in args:
            return 'missing id'
        typ = args['type']
        if typ == 'data':
            return postData()
        elif typ == 'subjects':
            if args['id'] not in cache:
                initCache(args['id'])
            cache[args['id']]['subjects'] = request.json
            return 'Success'
        elif typ == 'metadata':
            if args['id'] not in cache:
                initCache(args['id'])
            cache[args['id']]['metadata'] = request.json
            return 'Success'
        elif typ == 'similarity':
            if args['id'] not in cache:
                return f'id {args["id"]} not in cache'
            if 'runid' not in args:
                return 'missing runid'
            runs = cache[args['id']]['runs']
            for run in runs:
                if run['runid'] == int(args['runid']):
                    # Can overwrite old similarity for run
                    sim = request.json
                    run['sim'] = sim
                    return 'Success'
            return f'runid {args["runid"]} not in runs data'
        elif typ == 'image':
            if args['id'] not in cache:
                return f'id {args["id"]} not in cache'
            cache[args['id']]['image'] = request.json
            return 'Success'
        else:
            return 'type must be "data", "metadata", or "subjects"'
    except Exception as e:
        return f'exception: {e}'

def postData():
    args = request.args
    if 'runid' not in args:
        return 'missing runid'
    data = request.json
    if data['runid'] != int(args['runid']):
        return f'data and args have two different runids {data["runid"]} {args["runid"]}'
    if args['id'] not in cache:
        initCache(args['id'])
    prevData = cache[args['id']]['runs']
    for prev in prevData:
        if prev['runid'] == data['runid']:
            return f'duplicate runid {data["runid"]}'
    prevData.append(data)
    return f'Success'

def initCache(_id):
    cache[_id] = {}
    cache[_id]['runs'] = []
    cache[_id]['subjects'] = None
    cache[_id]['metadata'] = None
    
@app.route("/data", methods=['GET', 'POST'])
def getData():
    try:
        args = request.args
        if 'id' not in args:
            return 'missing id'
        if args['id'] not in cache:
            return f'no such id {args["id"]}'
        if 'runid' in args:
            return getRun()
        elif 'metadata' in args:
            if 'metadata' in cache[args['id']]:
                return jsonify(cache[args['id']]['metadata'])
            else:
                return 'no metadata'
        elif 'subjects' in args:
            if 'metadata' in cache[args['id']]:
                return jsonify(cache[args['id']]['subjects'])
            else:
                return 'no subjects'
        elif 'image' in args:
            if args['image'] == 'regions' or args['image'] == 'connections':
                return getImageWhenAvailable(args['id'], request.json)
        else:
            return 'data request must have runid, metadata, or subjects'
    except Exception as e:
        return f'exception: {e}'

def getImageWhenAvailable(id, image):
    cache[id]['image'] = image
    for i in range(10):
        time.sleep(1)
        if cache[id]['image'] is not image:
            json = jsonify(cache[id]['image'])
            del cache[id]['image']
            return json
    return jsonify({'error': f'Lib user for {id} did not create image {image} for client'})

def getRun():
    args = request.args
    if 'runid' not in args:
        return 'missing runid'
    others = []
    for prev in cache[args['id']]['runs']:
        others.append(prev['runid'])
        if prev['runid'] == int(args['runid']):
            return jsonify(prev)
    return f'no such runid {args["runid"]} {others}'

@app.route("/poll", methods=['GET'])
def poll():
    try:
        args = request.args
        if 'id' not in args:
            return jsonify({'error': 'missing id'})
        if args['id'] not in cache:
            return jsonify({'error': f'id {args["id"]} not in cache'})
        if 'image' in cache[args['id']]:
            return jsonify(cache[args['id']]['image'])
        return jsonify({'result': 'no image draw requests'})
    except Exception as e:
        return f'exception: {e}'
    
# run app from command line
#  sudo python3 flask-backend.py
# verified this way on development machine. Will verify on production machine
# sudo flask --app src/flask-backend/flask-backend.py run --host 0.0.0.0 --port 80 --no-debugger
if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 80
    app.run(host='localhost', port=port, threaded=True)

