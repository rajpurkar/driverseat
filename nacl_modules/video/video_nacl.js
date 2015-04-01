function VideoNACL(cam_file, id, parent_id, drawCanvas) { 

    this.VideoNACLModule = null;
    this.nacl_id = id;
    this.statusText = 'NO-STATUS';
    var nacl = this;
    var bytes = null; 
    var images = [ ]; 
	var disp_image = new Image();
    var fc = 0; 

    nacl.displayImage = function() { 
        var c = document.getElementById(drawCanvas);
        var ctx = c.getContext("2d");
        if (images[fc]) {
            var j = disp_image;
            j.onload = function() { 
                c.width = j.width;
                c.height = j.height;
                ctx.drawImage(j, 0, 0, c.width, c.height);
            }
            j.src = images[fc];
        }
        fc++;
        setTimeout(nacl.displayImage, 5);
    }

    nacl.updateStatus = function(opt_message) {
        if (opt_message)
            nacl.statusText = opt_message;
        var statusField = document.getElementById('statusField');
        if (statusField) {
            statusField.innerHTML = nacl.statusText;
        }
    }

    nacl.loadCallback = function(data) {
        bytes = new Uint8Array(data);
        console.log(bytes.length);
        var command = { cmd : 'raw_data',
            data: bytes.buffer,
            length: bytes.length};
        console.log(command);
        nacl.VideoNACLModule.postMessage(command);
        setTimeout(nacl.displayImage, 5); 
        //nacl.VideoNACLModule.postMessage("hello");
    }

    nacl.load = function( url ) {
        this.url = url;

        var request = new XMLHttpRequest();
        request.onreadystatechange = function() {		
            if( request.readyState == request.DONE && request.status == 200 ) {
                nacl.loadCallback(request.response);
            }
        };

        request.open('GET', url);
        request.responseType = "arraybuffer";
        request.send();
    };

    nacl.moduleDidLoad = function() {
        nacl.VideoNACLModule = document.getElementById(nacl.nacl_id);
        nacl.updateStatus('SUCCESS');
        nacl.load(cam_file);
    }

    nacl.handleMessage = function(message_event) {
        var data = message_event.data;
        if (data.Type == "CompressedJPEG") {
            images[data.FrameCount] = data.Data;
            //console.log(data.FrameCount);

        }
        //console.log(message_event.data);
    }

    nacl.pageDidLoad = function() {
        if (nacl.VideoNACLModule == null) {
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
    embed_obj.setAttribute('src', "pnacl/release/av_pnacl.nmf");
    embed_obj.setAttribute('type', "application/x-pnacl");
    embed_div.appendChild(embed_obj);

    document.getElementById(parent_id).appendChild(embed_div);

}
