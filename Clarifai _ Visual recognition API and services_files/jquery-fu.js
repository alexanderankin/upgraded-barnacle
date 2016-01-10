var htmlPageName = location.href.split("/").slice(-1);
var getUrlParameter = function (sParam) {
  var sPageURL = window.location.search.substring(1);
  var sURLVariables = sPageURL.split('&');
  for (var i = 0; i < sURLVariables.length; i++) {
    var sParameterName = sURLVariables[i].split('=');
    if (sParameterName[0] == sParam) {
      return sParameterName[1];
    }
  }
  return null;
};

$(function () {
  'use strict';

  var uploader = $('#fileupload');
  var urlInput = $("#imageurl");
  var formErrorBox = $("#form-error");
  var acceptedFileTypesPattern = /(\.|\/)(png|gif|jpe?g|mp4|avi|mpg|mpeg|webm|mov|mkv|flv|ogg)$/i;

  $.blueimp.fileupload.prototype.options.processQueue.push(
      {
        action: 'validateCaptcha'
      }
  );

  $.widget('blueimp.fileupload', $.blueimp.fileupload, {
    processActions: {
      validateCaptcha: function (data, options) {
        var dfd = $.Deferred();
        var that = this;

        var curCaptchaResponse = getCaptchaResponse();
        if (curCaptchaResponse['value'] === '') {
          var captchaContainer = $('#captcha-row');

          if (captchaContainer.is(':hidden')) {
            captchaContainer.show();

            $(document.body).animate({
              'scrollTop': $('#fileupload').offset().top
            }, 1000);
          }

          var captchaListener = function(e) {
            if (captchaContainer.is(':visible')) {
              captchaContainer.hide();
            }

            $(window).off('captcha.completed', captchaListener);

            dfd.resolveWith(that, [data]);
          };

          $(window).on('captcha.completed', captchaListener);
        } else {
          dfd.resolveWith(that, [data]);
        }

        return dfd.promise();
      }
    }
  });

  var resetForm = function(){
    urlInput.val('');
    formErrorBox.text('');
  };

  var flashError = function(text){
    formErrorBox.text(text);
    setTimeout(function(){ formErrorBox.text(""); }, 8000);
  };

  // Initialize the jQuery File Upload widget:
  uploader.fileupload({
    previewMaxWidth: previewMaxWidth,
    autoUpload: true,
    sequentialUploads: true,
    // limitConcurrentUploads: 1,
    acceptFileTypes: acceptedFileTypesPattern,
    loadVideoFileTypes: /(\.|\/)(mp4|avi|mpg|mpeg|webm|mov|mkv|flv|ogg)$/i,
    prependFiles: true,
    processQueue: [
      {
        action: 'validateCaptcha'
      },
      {
        action: 'validate',
        acceptFileTypes: acceptedFileTypesPattern,
      },
      {
        action: 'loadImageMetaData'
      },
      {
        action: 'loadImage',
        fileTypes: /^image\/(gif|jpeg|png)$/,
        maxFileSize: 20000000 // 20MB
      },
      {
        action: 'resizeImage',
        prefix: 'image',
        maxWidth: 1024,
        maxHeight: 1024,
        minWidth: 256,
        minHeight: 256,
        orientation: true,
        canvas: true
      },
      {
        action: 'saveImage'
      },
      {
        action: 'setImage'
      },
      {
        action: 'loadVideo'
      },
      {
        action: 'setVideo'
      }
    ],
    filesContainer: $('tbody.files'),
//	singleFileUploads: false,
    uploadTemplateId: null,
    downloadTemplateId: null,
    uploadTemplate: uploadTemplate,
    downloadTemplate: downloadTemplate
  });

  uploader.bind('fileuploadsubmit', function (e, data) {
    var displayNearest = true;
    var model = getUrlParameter("model");
    if (model === null) {
      model = "default";
    }
    else {
      displayNearest = false;
    }

    var language = getUrlParameter("language");
    if (language === null) {
      language = "en";
    }


    var mode = getUrlParameter("mode");
    if (mode === null) {
      if (htmlPageName === 'faces')
      {
        mode = "faces";
      }
      else
      {
        mode = "default";
      }
    }

    var ops = getUrlParameter("ops");
    if (ops === null) {
     ops = "default";
    }

    var video_type = "";
    var video_blob = "";
    if ('preview' in data.files[0] && /video/.exec(data.files[0].type)) {
      // For local video uploads, jwplayer needs the blob url and explicitly set type
      video_type = data.files[0].type;
      video_blob = data.files[0].preview.src;
    }

    var captchaResponse = getCaptchaResponse();
    if (captchaResponse['value'] === '')
      return false;

    data.formData = {
      timestamp: new Date().getTime(),
      image_url: urlInput.val(), //FIXME image_url should be renamed media_url project-wide
      csrfmiddlewaretoken: $('input[name="csrfmiddlewaretoken"]').val(),
      nearest: displayNearest,
      fd: true,
      model: model,
      mode: mode,
      ops: ops,
      language: language
    };

    data.formData[(captchaResponse['key'])] =  captchaResponse['value'];

    var media_url = data.formData.image_url.length > 0 ? data.formData.image_url : video_blob;
    uploadProgress(data.formData.timestamp, media_url, video_type);

    return true;
  });

  // masonry
  uploader.bind('fileuploadfinished', function (e, data) {
    uploadDone(e, data);
  });

  uploader.bind('fileuploaddone', resetForm);

  // Also trigger fileupload from the image url button.
  $('#fileupload-imgurl-btn').click(function (e) {
    e.preventDefault();
    var imgurl = urlInput.val();
    if (imgurl.length === 0) {
      flashError("You forgot to include a url!");
      return;
    }

    if (imgurl.indexOf("youtube") > -1 || imgurl.indexOf("youtu.be") > -1){
      flashError("Sorry, YouTube videos are not currently supported.\r\n" +
          "You can upload a file directly from your computer, or you can " +
          "use URLs that point directly to a video file,\r\n" +
          "for example: http://www.clarifai.com/examples/video.mp4.\r\n");
      return;
    }

    if (imgurl.indexOf("vimeo") > -1){
      flashError("Sorry, Vimeo videos are not currently supported.\r\n" +
          "You can upload a file directly from your computer, or you can " +
          "use URLs that point directly to a video file,\r\n" +
          "for example: http://www.clarifai.com/examples/video.mp4.\r\n");
      return;
    }

    if (!imgurl.match(acceptedFileTypesPattern)) {
      flashError("Your selected file does not appear to be of a supported filetype.");
      return;
    }

    uploader.fileupload('add', {
      files: [{name: imgurl}],  // Fake a file object.
      image_url: imgurl
    });
  });
});
