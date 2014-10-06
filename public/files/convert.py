import numpy as np 
import json
import sys

def runData(filepath):
	data = np.load(filepath)['data']
	data_subset = data[:1000000, :4]
	json.dump(data_subset.tolist(), open('datafile.json', 'w'))

def runGps(filepath):
	data = np.load(filepath)['data'];
	data_subset = data[:data.shape[0]/5, :3]
	json.dump(data_subset.tolist(), open('gpsfile.json', 'w'))

if __name__ == '__main__':
	runGps(sys.argv[1])