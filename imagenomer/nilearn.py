
import json
import numpy as np
import matplotlib.pyplot as plt
import nilearn.plotting as plotting
import io
import base64

from imagenomer.power264 import power_rois

'''
Client can request server to draw an image of regions or connections using nilearn.plotting
Used to be handled by polling the user python code <-> flask server <-> webapp
Now the flask server does the plotting
'''

def to_b64_string(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format='png')
    buf.seek(0)
    return base64.b64encode(buf.read()).decode()

def make_json_image_dict(req):
    if 'regions' in req:
        regs = req['regions']
        nodeCoords = np.zeros((len(regs),3))
        for i,reg in enumerate(regs):
            nodeCoords[i] = power_rois[reg]
        fig, ax = plt.subplots()
        plotting.plot_markers(np.ones(nodeCoords.shape[0]), nodeCoords, figure=fig, axes=ax)
        return {
            'b64': to_b64_string(fig),
        }
    elif 'connections' in req:
        cons = req['connections']
        Amap = {}
        count = 0
        for con in cons:
            for i in range(2):
                if con[i] not in Amap:
                    Amap[con[i]] = count
                    count += 1
        A = np.zeros((count, count))
        for con in cons:
            A[Amap[con[0]], Amap[con[1]]] = 1
        A = A + A.T
        nodeCoords = np.zeros((count,3))
        for reg in Amap.keys():
            nodeCoords[Amap[reg]] = power_rois[reg]
        fig, ax = plt.subplots()
        plotting.plot_connectome(A, nodeCoords, node_color='blue', figure=fig, axes=ax)
        return {
            'b64': to_b64_string(fig),
        }
    else:
        raise Exception('Bad client request type')
