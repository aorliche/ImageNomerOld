
import numpy as np

from imagenomer.main import JsonSimilarity

# Limited to 1 mod 1 task for now
def get_latsim_similarity(analysis, data, e, from_ids=None, to_ids=None, groups=None):
    n = e.shape[0]
    idcs = np.arange(n)
    to, frm = np.meshgrid(idcs, idcs, indexing='ij')
    edges = list(e.reshape(n*n).astype('float64'))
    to = list(to.reshape(n*n).astype('float64'))
    frm = list(frm.reshape(n*n).astype('float64'))
    # Change all indices in groups to float64
    for name,idx_lst in groups.items():
        groups[name] = list(np.array(idx_lst, dtype='float64'))
    dct = dict(
        Edges=edges,
        From=frm,
        To=to,
        FromIds=from_ids,
        ToIds=to_ids,
        Groups=groups
    )
    sim = JsonSimilarity(analysis, data)
    sim.update(dct)
    return sim


