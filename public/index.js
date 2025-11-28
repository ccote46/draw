const canvas = document.getElementById('drawing-board');
const toolbar = document.getElementById('toolbar');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let isPainting = false;
let isErasing = false;
let lineWidth = 5;
let currentColor = '#000000'; //keep og color after erase
let prevX, prevY;

ctx.strokeStyle = currentColor;

//websocket
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}`);

ws.onopen = () => console.log('Connected to server');

ws.onmessage = async (event) => {
    let text;

    //convert blob data to texts
    if (event.data instanceof Blob) {
        text = await event.data.text();
    }
    //if its text alr just use it
    else if (typeof event.data === "string") {
        text = event.data;
    }
    else {
        console.warn("Unknown message type:", event.data);
        return;
    }
    
    const data = JSON.parse(text);

    if (data.type === "init") {
        data.history.forEach(drawRemote);
    } 
    else if (data.type === "draw") {
        drawRemote(data);
    } 
    else if (data.type === "clear") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

ws.onclose = () => {
    console.log('Disconnected from server');
};

//add drawings from others 
function drawRemote(data) {
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.lineWidth;
    ctx.lineCap = 'round';
    
    if (data.action === 'start') {
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
    } else if (data.action === 'draw') {
        ctx.lineTo(data.x, data.y);
        ctx.stroke();
    } else if (data.action === 'end') {
        ctx.stroke();
        ctx.beginPath();
    }
}

//send drawings to server
function sendDrawData(action, x, y) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'draw',
            action: action,
            x: x,
            y: y,
            color: isErasing ? '#ffffff' : currentColor,
            lineWidth: lineWidth
        }));
    }
}

toolbar.addEventListener('click', e => {
    if (e.target.id === 'clear') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        //when clear is pressed get rid of it for everyone
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'clear' }));
        }
    }
    
    if (e.target.id === 'pencil') {
        isErasing = false;
        ctx.strokeStyle = currentColor;
        document.getElementById('pencil').classList.add('active');
        document.getElementById('eraser').classList.remove('active');
    }
    
    if (e.target.id === 'eraser') {
        isErasing = true;
        ctx.strokeStyle = '#ffffff';
        document.getElementById('eraser').classList.add('active');
        document.getElementById('pencil').classList.remove('active');
    }
});

toolbar.addEventListener('change', e => {
    if(e.target.id === 'stroke') {
        currentColor = e.target.value;
        if (!isErasing) {
            ctx.strokeStyle = currentColor;
        }
    }

    if(e.target.id === 'lineWidth') {
        lineWidth = e.target.value;
    }
});

//get cords dynamically
function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

const draw = (e) => {
    if (!isPainting) return;

    const {x, y} = getCanvasCoords(e);

    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(x, y);
    ctx.stroke();

    prevX = x;
    prevY = y;

    sendDrawData('draw', x, y);
};

canvas.addEventListener('mousedown', e => {
    isPainting = true;
    const {x, y} = getCanvasCoords(e);
    prevX = x;
    prevY = y;

    ctx.beginPath();
    sendDrawData('start', x, y);
});

canvas.addEventListener('mouseup', e => {
    if (isPainting) {
        isPainting = false;
        const {x, y} = getCanvasCoords(e);

        ctx.stroke();
        ctx.beginPath();

        sendDrawData('end', x, y);
    }
});

canvas.addEventListener('mousemove', draw);
