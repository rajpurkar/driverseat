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

def runLanes(filepath):
	allData = np.load(filepath);
	num_lanes = allData['num_lanes'].tolist()
	d = {}
	for i in xrange(num_lanes):
		data = allData['lane' + str(i)]
		data_subset = data[:data.shape[0]/5, :3]
		d[i] = data_subset.tolist();
	json.dump(d, open('lanesfile.json', 'w'));

if __name__ == '__main__':
	runLanes(sys.argv[1])