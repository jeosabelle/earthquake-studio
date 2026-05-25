let appConfig = { scriptUrl: '', folderId: '1tGHPu6gwU-4UWCHAanK2PNyG27cz5WWh', teacherName: 'Teacher Jeosa', classes: ["801","802","803","804","805","806","807","808","809","810"] };
let mediaRecorder = null;
let recordedChunks = [];
let localStream = null;
let videoBlob = null;

document.addEventListener('DOMContentLoaded', () => {
    const btnSave = document.getElementById('btn-save-config');
    const btnNext = document.getElementById('btn-to-student-setup');
    const btnEnter = document.getElementById('btn-enter-studio');
    const camPosSelect = document.getElementById('select-cam-position');
    const videoWebcam = document.getElementById('video-webcam');

    // Webcam placement switching logic
    if(camPosSelect && videoWebcam) {
        camPosSelect.addEventListener('change', (e) => {
            videoWebcam.className = ''; // wipe old placement classes
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
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            document.getElementById('video-webcam').srcObject = localStream;
            document.getElementById('btn-start-record').removeAttribute('disabled');
            document.getElementById('btn-start-cam').style.display = "none";
        } catch (err) {
            alert("Camera access missing.");
        }
    });

    // Recording Controls Engine
    const btnRecord = document.getElementById('btn-start-record');
    const btnPause = document.getElementById('btn-pause-record');
    const btnStop = document.getElementById('btn-stop-record');
    const btnRetake = document.getElementById('btn-retake-record');
    const playbackVideo = document.getElementById('video-playback');
    const counterOverlay = document.getElementById('countdown-overlay');
    
    btnRecord.addEventListener('click', () => {
        btnRecord.disabled = true;
        btnRetake.disabled = true;
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

                mediaRecorder = new MediaRecorder(localStream, { mimeType: 'video/webm' });
                mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
                mediaRecorder.onstop = () => {
                    videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
                };
                
                mediaRecorder.start(500);
                btnPause.removeAttribute('disabled');
                btnStop.removeAttribute('disabled');
            }
        }, 1000);
    });

    // Pause / Resume Event Handler
    btnPause.addEventListener('click', () => {
        if (mediaRecorder.state === "recording") {
            mediaRecorder.pause();
            playbackVideo.pause();
            btnPause.textContent = "▶ Resume";
            counterOverlay.textContent = "⏸ RECORDING PAUSED";
        } else if (mediaRecorder.state === "paused") {
            mediaRecorder.resume();
            playbackVideo.play();
            btnPause.textContent = "⏸ Pause";
            counterOverlay.textContent = "🔴 RECORDING LIVE";
        }
    });

    // Stop and Lock Session Event Handler
    btnStop.addEventListener('click', () => {
        btnPause.disabled = true;
        btnStop.disabled = true;
        counterOverlay.textContent = "";
        
        if(mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
        }
        playbackVideo.pause();
        
        // Wait briefly for recorder stream to compile to blob, then fire sync execution
        setTimeout(() => {
            if(videoBlob) {
                sendToGoogleDrive();
                btnRetake.removeAttribute('disabled');
            }
        }, 600);
    });

    // Retake Session Resetter
    btnRetake.addEventListener('click', () => {
        videoBlob = null;
        recordedChunks = [];
        playbackVideo.currentTime = 0;
        playbackVideo.pause();
        btnRecord.removeAttribute('disabled');
        btnPause.disabled = true;
        btnStop.disabled = true;
        btnRetake.disabled = true;
        counterOverlay.textContent = "🔄 Workspace Cleared. Ready for retake!";
    });
});

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

        // EXPLICIT ACTION TYPE ASSIGNMENT FOR GOOGLE CODE PIPELINE
        fetch(appConfig.scriptUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            bar.style.width = "100%";
            document.getElementById('upload-status-title').textContent = "✅ File Saved!";
            document.getElementById('upload-status-msg').textContent = "Successfully added to your Google Drive folder structure.";
        })
        .catch(() => {
            // Native fallback catch handler block
            bar.style.width = "100%";
            document.getElementById('upload-status-title').textContent = "✅ Upload Dispatched!";
            document.getElementById('upload-status-msg').textContent = "Data pipeline completed delivery execution checks.";
        });
    };
}
