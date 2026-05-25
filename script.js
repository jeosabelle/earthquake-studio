let appConfig = { scriptUrl: '', folderId: '1tGHPu6gwU-4UWCHAanK2PNyG27cz5WWh', teacherName: 'Teacher Jeosa', classes: ["801","802","803","804","805","806","807","808","809","810"] };
let mediaRecorder = null;
let recordedChunks = [];
let localStream = null;
let videoBlob = null;
let mixerCanvas = null;
let mixerContext = null;
let canvasAnimationId = null;

document.addEventListener('DOMContentLoaded', () => {
    const btnSave = document.getElementById('btn-save-config');
    const btnNext = document.getElementById('btn-to-student-setup');
    const btnEnter = document.getElementById('btn-enter-studio');
    const camPosSelect = document.getElementById('select-cam-position');
    const videoWebcam = document.getElementById('video-webcam');

    if(camPosSelect && videoWebcam) {
        camPosSelect.addEventListener('change', (e) => {
            videoWebcam.className = '';
            videoWebcam.classList.add(`pos-${e.target.value}`);
        });
    }

    btnSave.addEventListener('click', () => {
        appConfig.scriptUrl = document.getElementById('input-script-url').value.trim();
        appConfig.folderId = document.getElementById('input-folder-id').value.trim();
        appConfig.teacherName = document.getElementById('input-teacher-name').value.trim();
        const classInput = document.getElementById('input-classes').value;
        appConfig.classes = classInput.split(',').map(c => c.trim()).filter(c => c.length > 0);
        alert("✅ Configuration Saved!");
    });

    btnNext.addEventListener('click', () => {
        const select = document.getElementById('select-class');
        if(select) {
            select.innerHTML = '';
            appConfig.classes.forEach(cls => {
                const opt = document.createElement('option');
                opt.value = cls; opt.textContent = cls; select.appendChild(opt);
            });
        }
        document.getElementById('screen-config').classList.add('hidden');
        document.getElementById('screen-login').classList.remove('hidden');
    });

    document.getElementById('input-video-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('video-playback').src = URL.createObjectURL(file);
            document.getElementById('video-playback').load();
        }
    });

    btnEnter.addEventListener('click', () => {
        const cls = document.getElementById('select-class').value;
        const group = document.getElementById('input-group-name').value.trim() || "Group";
        const students = document.getElementById('input-students').value.trim() || "Students";
        document.getElementById('studio-group-tag').textContent = `${cls} - ${group} (${students})`;
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
            alert("Camera access missing.");
        }
    });

    const btnRecord = document.getElementById('btn-start-record');
    const btnPause = document.getElementById('btn-pause-record');
    const btnStop = document.getElementById('btn-stop-record');
    const btnRetake = document.getElementById('btn-retake-record');
    const btnDownload = document.getElementById('btn-download-backup');
    const playbackVideo = document.getElementById('video-playback');
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

                // Create an invisible canvas element to mix both video frames together
                mixerCanvas = document.createElement('canvas');
                mixerCanvas.width = 1280;
                mixerCanvas.height = 720;
                mixerContext = mixerCanvas.getContext('2d');

                // Start the live mixing loops frame by frame
                drawMixedFrames();

                // Capture combined video track from canvas and audio track from student microphone
                const canvasStream = mixerCanvas.captureStream(30); 
                const audioTrack = localStream.getAudioTracks()[0];
                if(audioTrack) {
                    canvasStream.addTrack(audioTrack);
                }

                mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm;codecs=vp8,opus' });
                mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
                mediaRecorder.onstop = () => {
                    videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
                    const reviewUrl = URL.createObjectURL(videoBlob);
                    videoReview.src = reviewUrl;
                    reviewContainer.classList.remove('hidden');
                    btnDownload.classList.remove('hidden');
                };
                
                mediaRecorder.start(500);
                btnPause.removeAttribute('disabled');
                btnStop.removeAttribute('disabled');
            }
        }, 1000);
    });

    // Pause/Resume Frame Mixers
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
        
        setTimeout(() => {
            if(videoBlob) {
                sendToGoogleDrive();
                btnRetake.removeAttribute('disabled');
            }
        }, 800);
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
        const tag = document.getElementById('studio-group-tag').textContent.replace(/[^a-zA-Z0-9_\-\(\)]/g, "_");
        const a = document.createElement('a');
        a.href = URL.createObjectURL(videoBlob);
        a.download = `${tag}_mixed_output.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });
});

// The Core Video Merging Loop
function drawMixedFrames() {
    const bgVideo = document.getElementById('video-playback');
    const camVideo = document.getElementById('video-webcam');
    const pos = document.getElementById('select-cam-position').value;

    if (!bgVideo || !camVideo || !mixerContext) return;

    // 1. Draw main earthquake dialogue video spanning full background
    mixerContext.drawImage(bgVideo, 0, 0, 1280, 720);

    // 2. Determine corner layout coordinates for placing the webcam overlay
    let camW = 280;
    let camH = 210;
    let camX = 1280 - camW - 30; // default bottom right
    let camY = 720 - camH - 30;

    if (pos === 'bottom-left') {
        camX = 30;
        camY = 720 - camH - 30;
    } else if (pos === 'top-right') {
        camX = 1280 - camW - 30;
        camY = 30;
    } else if (pos === 'top-left') {
        camX = 30;
        camY = 30;
    }

    // 3. Render webcam frame layout securely over background
    mixerContext.save();
    // Mirror webcam view so it acts naturally for students
    mixerContext.translate(camX + camW, camY);
    mixerContext.scale(-1, 1);
    mixerContext.drawImage(camVideo, 0, 0, camW, camH);
    mixerContext.restore();

    // Loop at 30 frames per second continuously
    canvasAnimationId = requestAnimationFrame(drawMixedFrames);
}

function sendToGoogleDrive() {
    const toast = document.getElementById('upload-status-toast');
    const bar = document.getElementById('upload-progress');
    toast.classList.remove('hidden');
    bar.style.width = "40%";

    const reader = new FileReader();
    reader.readAsDataURL(videoBlob);
    reader.onloadend = () => {
        const base64Data = reader.result.split(',')[1];
        bar.style.width = "70%";

        const payload = {
            filename: `${document.getElementById('studio-group-tag').textContent.replace(/[^a-zA-Z0-9_\-\(\)]/g, "_")}.webm`,
            mimeType: "video/webm",
            rootFolderId: appConfig.folderId,
            classDesignation: document.getElementById('studio-group-tag').textContent.split(' - ')[0],
            fileData: base64Data
        };

        fetch(appConfig.scriptUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        })
        .then(() => {
            bar.style.width = "100%";
            document.getElementById('upload-status-title').textContent = "✅ File Saved!";
            document.getElementById('upload-status-msg').textContent = "Successfully added to your Google Drive folder structure.";
        })
        .catch(() => {
            bar.style.width = "100%";
            document.getElementById('upload-status-title').textContent = "Upload Finished";
            document.getElementById('upload-status-msg').textContent = "Review video below. Use purple button if Drive is empty.";
        });
    };
}
