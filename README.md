# RoadGL

## A web-based system that enables crowds to label lane complexes in the 3D environment around a car.

### Quickstart
1. install nodejs and npm (versions >=v0.10.* and >=1.4.* respectively https://docs.npmjs.com/getting-started/installing-node)
2. In the repo folder, 'npm install' to install dependencies
3. Setup the database (See "Database Setup")
4. start the server with "node app.js". For info about the web-framework: http://expressjs.com/4x/api.html. For faster dev, I use 'nodemon app.js' (http://nodemon.io/)

### Database Setup
* install mongodb: http://www.mongodb.org/downloads (tested with v2.4.6, but should work with higher)
* start 'mongod' as a background process: http://docs.mongodb.org/manual/reference/program/mongod/ (the daemon should be running when the server is started)
