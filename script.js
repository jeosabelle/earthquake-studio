// Paste your Video string code between the quotes in videoAssetData if embedding entirely!
let videoAssetData = ""; 
let mediaRecorder = null;
let recordedChunks = [];
let localStream = null;
let videoBlob = null;
let mixerCanvas = null;
let mixerContext = null;
let canvasAnimationId = null;

document.addEventListener('DOMContentLoaded', () => {
    const btnEnter = document.getElementById('btn-enter-studio');
    const camPosSelect = document.getElementById('select-cam-position');
    const videoWebcam = document.getElementById('video-webcam');
    const playbackVideo = document.getElementById('video-playback');

    // Automatically assign video source asset if embedded
    if (videoAssetData && videoAssetData.length > 10) {
        playbackVideo.src = videoAssetData;
    } else {
        // Fallback default sample file link if you prefer to load it from an external web address link
        playbackVideo.src = "earthquake.mp4"; 
    }
    playbackVideo.load();

    if(camPosSelect && videoWebcam) {
        camPosSelect.addEventListener('change', (e) => {
            videoWebcam.className = '';
            videoWebcam.classList.add(`pos-${e.target.value}`);
        });
    }

    btnEnter.addEventListener('click', () => {
        const cls = document.getElementById('select-class').value;
        const group = document.getElementById('input-group-name').value.trim() || "Group";
        const students = document.getElementById('input-students').value.trim() || "NoNumbers";
        
        document.getElementById('studio-group-tag').textContent = `${cls}_${group.replace(/\s+/g, '')}_Nos_${students.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        document.getElementById('screen-login').classList.add('hidden');
        document.getElementById('screen-studio').classList.remove('hidden');
    });

    document.getElementById('btn-start-cam').addEventListener('click', async () => {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true });
            document.getElementById('video-webcam').srcObject = localStream;
            document.getElementById('btn-start-record').removeAttribute('disabled');
            document.getElementById('btn-start-cam').style.display = "none";
        } catch (err) {
            alert("Camera or Microphone access missing. Please allow browser permissions.");
        }
    });

    const btnRecord = document.getElementById('btn-start-record');
    const btnPause = document.getElementById('btn-pause-record');
    const btnStop = document.getElementById('btn-stop-record');
    const btnRetake = document.getElementById('btn-retake-record');
    const btnDownload = document.getElementById('btn-download-backup');
    const counterOverlay = document.getElementById('countdown-overlay');
    const reviewContainer = document.getElementById('review-container');
    const videoReview = document.getElementById('video-review');
    
    btnRecord.addEventListener('click', () => {
        btnRecord.disabled = true;
        btnRetake.disabled = true;
        btnDownload.classList.add('hidden');
        reviewContainer.classList.add('hidden');
        videoReview.src = "";
        
        let count = 3;
        counterOverlay.textContent = `Starting in ${count}...`;
        
        const timer = setInterval(() => {
            count--;
            if(count > 0) {
                counterOverlay.textContent = `Starting in ${count}...`;
            } else {
                clearInterval(timer);
                counterOverlay.textContent = "🔴 RECORDING LIVE";
                
                recordedChunks = [];
                playbackVideo.currentTime = 0;
                playbackVideo.play();

                mixerCanvas = document.createElement('canvas');
                mixerCanvas.width = 1280;
                mixerCanvas.height = 720;
                mixerContext = mixerCanvas.getContext('2d');

                drawMixedFrames();

                const canvasStream = mixerCanvas.captureStream(30); 
                const audioTrack = localStream.getAudioTracks()[0];
                if(audioTrack) {
                    canvasStream.addTrack(audioTrack);
                }

                mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm;codecs=vp8,opus' });
                mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
                mediaRecorder.onstop = () => {
                    videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
                    videoReview.src = URL.createObjectURL(videoBlob);
                    reviewContainer.classList.remove('hidden');
                    btnDownload.classList.remove('hidden');
                };
                
                mediaRecorder.start(500);
                btnPause.removeAttribute('disabled');
                btnStop.removeAttribute('disabled');
            }
        }, 1000);
    });

    btnPause.addEventListener('click', () => {
        if (mediaRecorder.state === "recording") {
            mediaRecorder.pause();
            playbackVideo.pause();
            btnPause.textContent = "▶ Resume";
            counterOverlay.textContent = "⏸ RECORDING PAUSED";
            cancelAnimationFrame(canvasAnimationId);
        } else if (mediaRecorder.state === "paused") {
            mediaRecorder.resume();
            playbackVideo.play();
            btnPause.textContent = "⏸ Pause";
            counterOverlay.textContent = "🔴 RECORDING LIVE";
            drawMixedFrames();
        }
    });

    btnStop.addEventListener('click', () => {
        btnPause.disabled = true;
        btnStop.disabled = true;
        counterOverlay.textContent = "";
        
        cancelAnimationFrame(canvasAnimationId);
        if(mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
        }
        playbackVideo.pause();
        btnRetake.removeAttribute('disabled');
    });

    btnRetake.addEventListener('click', () => {
        videoBlob = null;
        recordedChunks = [];
        playbackVideo.currentTime = 0;
        playbackVideo.pause();
        reviewContainer.classList.add('hidden');
        videoReview.src = "";
        btnDownload.classList.add('hidden');
        btnRecord.removeAttribute('disabled');
        btnPause.disabled = true;
        btnStop.disabled = true;
        btnRetake.disabled = true;
        counterOverlay.textContent = "🔄 Workspace Cleared. Ready for retake!";
    });

    btnDownload.addEventListener('click', () => {
        if(!videoBlob) return;
        const filenameTag = document.getElementById('studio-group-tag').textContent;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(videoBlob);
        a.download = `${filenameTag}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });
});

function drawMixedFrames() {
    const bgVideo = document.getElementById('video-playback');
    const camVideo = document.getElementById('video-webcam');
    const pos = document.getElementById('select-cam-position').value;

    if (!bgVideo || !camVideo || !mixerContext) return;

    mixerContext.drawImage(bgVideo, 0, 0, 1280, 720);

    let camW = 280;
    let camH = 210;
    let camX = 1280 - camW - 30;
    let camY = 720 - camH - 30;

    if (pos === 'bottom-left') {
        camX = 30; camY = 720 - camH - 30;
    } else if (pos === 'top-right') {
        camX = 1280 - camW - 30; camY = 30;
    } else if (pos === 'top-left') {
        camX = 30; camY = 30;
    }

    mixerContext.save();
    mixerContext.translate(camX + camW, camY);
    mixerContext.scale(-1, 1);
    mixerContext.drawImage(camVideo, 0, 0, camW, camH);
    mixerContext.restore();

    canvasAnimationId = requestAnimationFrame(drawMixedFrames);
}
