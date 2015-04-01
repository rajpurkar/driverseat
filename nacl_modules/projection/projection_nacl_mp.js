function ProjectionNACL(cam_file, id, parent_id) { 

    this.ProjectionNACLModule = null;
    this.nacl_id = id;
    this.statusText = 'NO-STATUS';
    var nacl = this;
    
    nacl.updateStatus = function(opt_message) {
        if (opt_message)
            nacl.statusText = opt_message;
        var statusField = document.getElementById('statusField');
        if (statusField) {
            statusField.innerHTML = nacl.statusText;
        }
    }

    nacl.projectPoints = function(params) {
        var p = params;
        var command = { } 
        command['cmd'] = 'project'; 
        for (var key in params) 
            command[key] = params[key]

        nacl.ProjectionNACLModule.postMessage(command);

    }

    nacl.loadCallback = function() {
        var NUM_DATA = 10*3;
        var points = new Float32Array(NUM_DATA);
        for (var i = 0; i < NUM_DATA; i++) { 
            points[i] = i;
            if ( (i+1) % 3 == 0 ) points[i] = 10; 
        }
        var colors = new Float32Array(NUM_DATA);
        for (var i = 0; i < NUM_DATA; i++) { 
            colors[i] = i
        }

        var KK_data = new Float32Array([200, 0, 640,
                                        0, 200, 480,
                                        0, 0, 1]); 

        var E_data = new Float32Array([1, 0, 0, 0,
                                       0, 1, 0, 0,
                                       0, 0, 1, 0,
                                       0, 0, 0, 1]);

        var dist_data = new Float32Array([0,0,0,0]);

        var image_width = 1280;
        var image_height = 960;
        var z_near_clip = 0;
        var z_far_clip= 100;
        
        var projectionParams = {
            point_data: points.buffer,
            point_data_buffer_size: points.length,
            color_data: colors.buffer,
            color_data_buffer_size: colors.length,
            E_data : E_data.buffer,
            KK_data : KK_data.buffer,
            dist_data : dist_data.buffer,
            dist_data_buffer_size : dist_data.length,
            image_width : image_width,
            image_height : image_height, 
            z_near_clip : z_near_clip,
            z_far_clip : z_far_clip,
            canvas_id : "dwhello"
        };
        nacl.projectPoints(projectionParams);
    }

    nacl.lol = function() { 
        setTimeout(nacl.lol, 5);
        nacl.ProjectionNACLModule.postMessage(command);
    }

    nacl.moduleDidLoad = function() {
        nacl.ProjectionNACLModule = document.getElementById(nacl.nacl_id);
        nacl.updateStatus('SUCCESS');
        nacl.loadCallback();
    }

    nacl.handleMessage = function(message_event) {
        var data = message_event.data;
        if (data.Command == "projection") {
            var pixels = new Float32Array(data.pixel_data);
            var colors = new Float32Array(data.color_data);
            console.log(pixels);
            console.log(data.canvas_id);
            //console.log(colors);
        }
    }

    nacl.pageDidLoad = function() {
        if (nacl.ProjectionNACLModule == null) {
            nacl.updateStatus('LOADING...');
        } else {
            nacl.updateStatus();
        }
    }

    var embed_div = document.createElement("div");
    embed_div.setAttribute('id', 'div_'+id);
    embed_div.addEventListener('load', this.moduleDidLoad, true);
    embed_div.addEventListener('message', this.handleMessage, true);
    var embed_obj = document.createElement("embed");
    embed_obj.setAttribute('id', id);
    embed_obj.setAttribute('width', 0);
    embed_obj.setAttribute('height', 0);
    embed_obj.setAttribute('src', "pnacl/release/projection.nmf");
    embed_obj.setAttribute('type', "application/x-pnacl");
    embed_div.appendChild(embed_obj);

    document.getElementById(parent_id).appendChild(embed_div);

}
