import numpy as np 
import json
import sys

def run(filepath):
	data = np.load(filepath)['data']
	data_subset = data[:5000, :4]
	json.dump(data_subset.tolist(), open('datafile.json', 'w'))

if __name__ == '__main__':
	run(sys.argv[1])