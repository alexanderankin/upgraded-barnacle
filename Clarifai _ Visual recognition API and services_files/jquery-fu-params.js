var previewMaxWidth = 1024;
function uploadTemplate(o) {
  var rows = $();
  $.each(o.files, function (index, file) {
    var context = {
      index: index,
      autoUpload: o.options.autoUpload,
      file: file,
      isURL: typeof file.name === "undefined" ? false : file.name.indexOf('http') == 0
    };
    rows = rows.add($(progressTemplate(context)));
  });
  return rows;
}

var videoCount = 0;
var chartStates = {};
var nameTimeStampToContainerID = {};
var timeStampToVideoID = {};
var timeStampToVideoCounter = {};

function nameTimeStampToKey(name, timestamp) {
  return name.toString() + '_' + timestamp.toString();
}

function getNextVideoID(timestamp) {
  videoCount = videoCount + 1;
  timeStampToVideoCounter[timestamp] = videoCount.toString();
  videoID = "cont_video_" + videoCount.toString();
  timeStampToVideoID[timestamp] = videoID;
  return videoID;
}
function isVideoFile(videoURL) {
  return (/(\.|\/)(mp4|avi|mpg|mpeg|webm|mov|mkv|flv|ogg)$/i.exec(videoURL)) != true;
}

function downloadTemplate(o) {
  var rows = $();

  $.each(o.files, function (index, file) {
    var row = null;
    if (file.status != 'OK') {
      rows = rows.add($(demoErrorTemplate(file)));
      if (file.error === 'FORBIDDEN') {
        resetCaptcha();
      }
    } else if (file.video_result) {
      var containerID = "video_" + timeStampToVideoCounter[file.timestamp];
      var videoID = timeStampToVideoID[file.timestamp];
      nameTimeStampToContainerID[nameTimeStampToKey(file.name, file.timestamp)] = containerID;

      var context = {
        container_id: containerID,
        video_id: videoID
      };
      row = $(videoChartTemplate(context));
      rows = rows.add(row);

      chartStates[containerID] = new ChartState(
          row,
          file.video_result,
          containerID,
          videoID);

    } else {
        rows = rows.add($(imageTemplate(file)));
        if ('model_results' in file) {
          if ('faces' in file['model_results'][0]) {
              window.setTimeout(function () {
                  drawBoundingBoxes(file['results_id'], file['container_id'], file['image_id'], file['model_results'][0]['faces'])
              }, 400);
          }
        }
    }
  });
  return rows;
}

function uploadProgress(timestamp, media_url, video_type) {
  // Move down so overall progress is directly at the top. The form is a good place to align things
  // so that the progress isn't in the header which is over the top.

  $(document.body).animate({
    'scrollTop': $('#fileupload').offset().top
  }, 1000);

  if (isVideoFile(media_url) || /video/.exec(video_type)) {
    var videoID = getNextVideoID(timestamp);
    var videoDiv = $(videoTemplate({video_id: videoID}));
    var videoSettings = {file: media_url, width: "100%", stretching: 'uniform', aspectratio: "16:9"};
    if (/video/.exec(video_type)) {
      // video_type is set/required for local video uploads
      videoSettings.type = video_type;
    }

    $("#videoHolder").append(videoDiv);

    // TODO(vinay): This is horrible... figure out if jwplayer has a method to inject itself
    // into an element.
    window.setTimeout(function() {
      jwplayer(videoID).setup(videoSettings);
    }, 1000);
  }
}

function uploadDone(e, data) {
  if ('result' in data && 'files' in data.result && data.result.files.length > 0 &&
      'video_result' in data.result.files[0]) {
    var file_dict = data.result.files[0];
    var key = nameTimeStampToKey(file_dict.name, file_dict.timestamp);
    var chartState = chartStates[nameTimeStampToContainerID[key]];

    $("#".concat(chartState.playerID)).detach().prependTo("#".concat(chartState.containerID));
    //chartState.setupVideo();
    window.setTimeout(function() {
      chartState.setupGraph(5);
      chartState.setupOnClick();
      container = $("#".concat(chartState.containerID));
    }, 1);

  } else {
    // imgcontainer doesn't appear until fileupload finishes
    // var $container = $('#imgcontainer').masonry();
    $('.img-container').each(function () {
      var $container = $(this);
      // layout Masonry again after all images have loaded
      $container.imagesLoaded(function () {

        // console.log($container);
        $container.masonry({
          // options
          columnWidth: 10,
          itemSelector: '.item'
        });
      });
    });
  }
}

function hasClass(element, cls) {
    return (' ' + element.className + ' ').indexOf(' ' + cls + ' ') > -1;
}

function findParent(element, matches)
{
    if (!element.parentNode) {
        return false;
    } else if (matches(element.parentNode)) {
        return element.parentNode;

    } else {
        return findParent(element.parentNode, matches);
    }
}

function extractBboxIndex (element) {
    var boundingBox = findParent(element, function(parent) {
        return hasClass(parent, 'bbox');
    });

    if (boundingBox) {
        var string_ind = boundingBox.className.indexOf("bbox-");
        if (string_ind > -1) {
            //var string_number = boundingBox.className.substring(string_ind + 5 );
            var string_number = "";
            for (i = string_ind + 5; i < boundingBox.className.length; i++) {
                if (boundingBox.className[i] === " "){
                    break;
                } else{
                    string_number += boundingBox.className[i];
                }
            }
            return(string_number);
        } else {
            return -1;
        }
    }
}

// Grabbed from draw.js
var drawBoundingBoxes = function (results_id, containerID, imageID, faces) {
    var container = document.getElementById(containerID);
    var celeb_container = document.getElementById(results_id);

    // Find the image element from local file uploaded
    // If not existant, we have url upload

    // Local image upload
    var container_children = container.childNodes;
    for (var i = 0; i < container_children.length; i++){
        if (container_children[i].localName === "canvas") {
            var image_element = container_children[i];
        }
    }

    // URL image upload
    if (!image_element)
        image_element = document.getElementById(imageID);


    for (var i = 0; i < faces.length; i++) {
        var bbox = faces[i];
        var bboxDiv = document.createElement("div");
        container.appendChild(bboxDiv);
        bboxDiv.className = "bbox bbox-" + i;
        bboxDiv.style.position = "absolute";


        addMouseOverInfo(celeb_container, bboxDiv);

        // Filler position has to be relative
        var bboxFiller = document.createElement("div");
        bboxFiller.className = "bboxFiller";
        bboxDiv.appendChild(bboxFiller);

        bboxDiv.style.left = bbox['x_perc'] * image_element.clientWidth + "px";
        bboxDiv.style.top = bbox['y_perc'] * image_element.clientHeight + "px";
        bboxDiv.style.width = bbox['width_perc'] * image_element.clientWidth + "px";
        bboxDiv.style.height = bbox['height_perc'] * image_element.clientHeight + "px";

        // Show Celeb Name if above threshold
        //if (bbox.confidence > 90) {
        if (bbox.probabilities[0] > 00) {
            var text = document.createTextNode(bbox['name']);
            var infoDiv = document.createElement("div");

            bboxFiller.appendChild(infoDiv);
            infoDiv.className = "bboxInfo";
            infoDiv.appendChild(text);
            infoDivHeight = infoDiv.clientHeight + 3;
            infoDiv.style.bottom = "-" + infoDivHeight + "px"
        }
    }
};

function addMouseOverInfo(celeb_container, bboxDiv){
    // On mouse display predicted info
    bboxDiv.addEventListener("mouseover", function (event) {
        var index = extractBboxIndex(event.target);
        if (index > -1) {
            var searchForClass = "prediction-" + index;
            for (var j = 0; j < celeb_container.childNodes.length; j++) {

                if (hasClass(celeb_container.childNodes[j], searchForClass)){
                    celeb_container.childNodes[j].style.display = "inherit";
                }
            }
        }
    });

    // On mouse out remove predicted info
    bboxDiv.addEventListener("mouseout", function (event) {
        var index = extractBboxIndex(event.target);
        if (index > -1) {
            var searchForClass = "prediction-" + index;
            for (var j = 0; j < celeb_container.childNodes.length; j++) {

                if (hasClass(celeb_container.childNodes[j], searchForClass)){
                    celeb_container.childNodes[j].style.display = "none";
                }
            }
        }
    });
}

