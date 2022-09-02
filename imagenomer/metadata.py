
from imagenomer.main import JsonCommunityMetadata
from imagenomer.power264 import power_comm_affil_idcs, power_comm_names_short, power_comm_expected

def get_power_community_metadata(analysis):
    meta = JsonCommunityMetadata(analysis)
    meta.update({
        'CommunityMap': power_comm_affil_idcs, 
        'CommunityNames': power_comm_names_short, 
        'Expected': power_comm_expected,
        'Template': '(\d+)-(\d+)'})
    return meta

