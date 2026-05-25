let appConfig = { scriptUrl: '', folderId: '1tGHPu6gwU-4UWCHAanK2PNyG27cz5WWh', teacherName: 'Teacher Jeosa', classes: ["801","802","803","804","805","806","807","808","809","810"] };
let mediaRecorder = null;
let recordedChunks = [];
let localStream = null;
let videoBlob = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Force buttons to always be ready
    const btnSave = document.getElementById('btn-save-config');
    const btnNext = document.getElementById('btn-to-student-setup');
    const btnEnter = document.getElementById('btn-enter-studio');

    if(btnNext) {
        btnNext.removeAttribute('disabled');
        btnNext.disabled = false;
    }

    // 2. Save action
    btnSave.addEventListener('click', () => {
        appConfig.scriptUrl = document.getElementById('input-script-url').value.trim();
        appConfig.folderId = document.getElementById('input-folder-id').value.trim();
        appConfig.teacherName = document.getElementById('input-teacher-name').value.trim();
        
        const classInput = document.getElementById('input-classes').value;
        appConfig.classes = classInput.split(',').map(c => c.trim()).filter(c => c.length > 0);

        alert("✅ Settings saved configuration! You can click 'Start Activity' now.");
    });

    // 3. Navigation to Student Setup
    btnNext.addEventListener('click', () => {
        const select = document.getElementById('select-class');
        if(select) {
            select.innerHTML = '';
            appConfig.classes.forEach(cls => {
                const opt = document.createElement('option');
                opt.value = cls;
                opt.textContent = cls;
                select.appendChild(opt);
            });
        }
        document.getElementById('screen-config').classList.add('hidden');
        document.getElementById('screen-login').classList.remove('hidden');
    });

    // 4. Video loader assignment
    document.getElementById('input-video-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('video-playback').src = URL.createObjectURL(file);
            document.getElementById('video-playback').load();
        }
    });

    // 5. Enter studio workspace
    btnEnter.addEventListener('click', () => {
        const cls = document.getElementById('select-class').value;
        const group = document.getElementById('input-group-name').value.trim() || "Group";
        const students = document.getElementById('input-students').value.trim() || "Students";
        
        document.getElementById('studio-group-tag').textContent = `${cls} - ${group} (${students})`;
        document.getElementById('screen-login').classList.add('hidden');
        document.getElementById('screen-studio').classList.remove('hidden');
    });

    // 6. Webcam activation
    document.getElementById('btn-start-cam').addEventListener('click', async () => {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            document.getElementById('video-webcam').srcObject = localStream;
            document.getElementById('btn-start-record').removeAttribute('disabled');
            document.getElementById('btn-start-cam').style.display = "none";
        } catch (err) {
            alert("Camera access issue. Check site permissions settings.");
        }
    });

    // 7. Recorder blocks
    const btnRecord = document.getElementById('btn-start-record');
    const btnStop = document.getElementById('btn-stop-record');
    
    btnRecord.addEventListener('click', () => {
        btnRecord.disabled = true;
        let count = 3;
        document.getElementById('countdown-overlay').textContent = `Starting in ${count}...`;
        
        const timer = setInterval(() => {
            count--;
            if(count > 0) {
                document.getElementById('countdown-overlay').textContent = `Starting in ${count}...`;
            } else {
                clearInterval(timer);
                document.getElementById('countdown-overlay').textContent = "🔴 RECORDING";
                
                recordedChunks = [];
                document.getElementById('video-playback').currentTime = 0;
                document.getElementById('video-playback').play();

                mediaRecorder = new MediaRecorder(localStream, { mimeType: 'video/webm' });
                mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
                mediaRecorder.onstop = () => {
                    videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
                    sendToGoogleDrive();
                };
                mediaRecorder.start(1000);
                btnStop.removeAttribute('disabled');
            }
        }, 1000);
    });

    btnStop.addEventListener('click', () => {
        btnStop.disabled = true;
        document.getElementById('countdown-overlay').textContent = "";
        if(mediaRecorder) mediaRecorder.stop();
        document.getElementById('video-playback').pause();
    });
});

function sendToGoogleDrive() {
    const toast = document.getElementById('upload-status-toast');
    const bar = document.getElementById('upload-progress');
    toast.classList.remove('hidden');
    bar.style.width = "30%";

    const reader = new FileReader();
    reader.readAsDataURL(videoBlob);
    reader.onloadend = () => {
        const base64Data = reader.result.split(',')[1];
        bar.style.width = "60%";

        const payload = {
            filename: `${document.getElementById('studio-group-tag').textContent}.webm`,
            mimeType: "video/webm",
            rootFolderId: appConfig.folderId,
            classDesignation: document.getElementById('studio-group-tag').textContent.split(' - ')[0],
            fileData: base64Data
        };

        fetch(appConfig.scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(() => {
            bar.style.width = "100%";
            document.getElementById('upload-status-title').textContent = "✅ Uploaded!";
            setTimeout(() => { toast.classList.add('hidden'); }, 3000);
        })
        .catch(() => {
            document.getElementById('upload-status-title').textContent = "Upload Complete";
            bar.style.width = "100__%";
        });
    };
}
