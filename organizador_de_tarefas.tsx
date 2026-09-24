import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, Play, Trash2, X, Plus, Bell, AlignJustify } from 'lucide-react';

const GRID_SIZE = 48; // Standard comfortable touch height
const COLORS = [
  { name: 'Azul', value: 'bg-blue-100 border-blue-300 text-blue-900' },
  { name: 'Verde', value: 'bg-green-100 border-green-300 text-green-900' },
  { name: 'Amarelo', value: 'bg-yellow-100 border-yellow-300 text-yellow-900' },
  { name: 'Rosa', value: 'bg-pink-100 border-pink-300 text-pink-900' },
  { name: 'Roxo', value: 'bg-purple-100 border-purple-300 text-purple-900' },
];

const timeToMins = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const formatTime = (date) => {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export default function App() {
  const [tasks, setTasks] = useState([
    { id: '1', title: 'Revisar emails', desc: 'Responder urgentes', color: COLORS[0], startTime: '14:00', endTime: '14:30', yPos: GRID_SIZE * 3 },
    { id: '2', title: 'Reunião de Alinhamento', desc: '', color: COLORS[2], startTime: '15:00', endTime: '16:00', yPos: GRID_SIZE * 6 }
  ]);

  const [markers, setMarkers] = useState({
    start: { id: 'm1', label: 'Início da Tarde', time: '13:00', yPos: GRID_SIZE * 1 },
    end: { id: 'm2', label: 'Final da Tarde', time: '18:00', yPos: GRID_SIZE * 12 }
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Drag & Swipe State
  const [dragState, setDragState] = useState({ active: false, id: null, type: null, startY: 0, currentY: 0, startX: 0, currentX: 0, initialY: 0 });
  const [swipedId, setSwipedId] = useState(null);

  // Modals State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalY, setModalY] = useState(0);
  const [timerModalOpen, setTimerModalOpen] = useState(false);
  const [selectedTaskForTimer, setSelectedTaskForTimer] = useState(null);

  // Timer State
  const [timer, setTimer] = useState({ active: false, type: 'countdown', targetTime: null, remainingSeconds: 0, taskTitle: '' });

  // Refs for tracking container layout
  const containerRef = useRef(null);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Timer countdown logic
  useEffect(() => {
    let interval;
    if (timer.active) {
      interval = setInterval(() => {
        if (timer.type === 'countdown') {
          setTimer(prev => {
            if (prev.remainingSeconds <= 1) {
              alert(`O tempo da tarefa "${prev.taskTitle}" acabou!`);
              return { ...prev, active: false, remainingSeconds: 0 };
            }
            return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
          });
        } else if (timer.type === 'alarm' && timer.targetTime) {
          const now = new Date();
          const target = new Date();
          const [h, m] = timer.targetTime.split(':').map(Number);
          target.setHours(h, m, 0, 0);
          
          if (now >= target) {
            alert(`Aviso: Horário de finalização da tarefa "${timer.taskTitle}" atingido!`);
            setTimer(prev => ({ ...prev, active: false }));
          }
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer.active, timer.type, timer.targetTime, timer.taskTitle]);

  // Calculate Y position for the time indicator dot
  const dotYPosition = useMemo(() => {
    const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();
    
    let anchors = [
      { time: timeToMins(markers.start.time), y: markers.start.yPos },
      { time: timeToMins(markers.end.time), y: markers.end.yPos }
    ];

    tasks.forEach(t => {
      if (t.startTime) anchors.push({ time: timeToMins(t.startTime), y: t.yPos });
    });

    // Remove duplicates and sort by time
    anchors = anchors.reduce((acc, current) => {
      const x = acc.find(item => item.time === current.time);
      if (!x) { return acc.concat([current]); } else { return acc; }
    }, []).sort((a, b) => a.time - b.time);

    if (anchors.length < 2) return markers.start.yPos; // Fallback

    // Find the segment the current time falls into
    let prevAnchor = anchors[0];
    let nextAnchor = anchors[anchors.length - 1];

    if (currentMins <= prevAnchor.time) return prevAnchor.y;
    if (currentMins >= nextAnchor.time) return nextAnchor.y;

    for (let i = 0; i < anchors.length - 1; i++) {
      if (currentMins >= anchors[i].time && currentMins < anchors[i+1].time) {
        prevAnchor = anchors[i];
        nextAnchor = anchors[i+1];
        break;
      }
    }

    // Interpolate
    const timeRange = nextAnchor.time - prevAnchor.time;
    if (timeRange === 0) return prevAnchor.y; // Avoid division by zero
    
    const progress = (currentMins - prevAnchor.time) / timeRange;
    const yRange = nextAnchor.y - prevAnchor.y;
    
    return prevAnchor.y + (yRange * progress);

  }, [currentTime, tasks, markers]);

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!dragState.active) return;
      e.preventDefault(); // Prevent scrolling while dragging

      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;

      let type = dragState.type;
      if (!type) {
        // Determine drag intent
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) type = 'swipe';
        else if (Math.abs(dy) > 10) type = 'drag';
        
        if (type) setDragState(prev => ({ ...prev, type }));
      }

      if (type === 'drag') {
        setDragState(prev => ({ ...prev, currentY: e.clientY }));
      } else if (type === 'swipe') {
        setDragState(prev => ({ ...prev, currentX: e.clientX }));
      }
    };

    const handlePointerUp = () => {
      if (!dragState.active) return;

      if (dragState.type === 'drag') {
        // Snap to grid
        const containerRect = containerRef.current.getBoundingClientRect();
        // Calculate raw Y relative to container
        let rawY = (dragState.currentY - containerRect.top) - (dragState.startY - dragState.initialY - containerRect.top);
        // Correct calculation for new Y relative to initial position
        const dy = dragState.currentY - dragState.startY;
        let newY = dragState.initialY + dy;
        
        // Snap
        newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
        // Keep within bounds
        newY = Math.max(0, newY);

        setTasks(prev => prev.map(t => t.id === dragState.id ? { ...t, yPos: newY } : t));
      } else if (dragState.type === 'swipe') {
        const dx = dragState.currentX - dragState.startX;
        if (dx < -60) {
          setSwipedId(dragState.id);
        } else if (dx > 60 && swipedId === dragState.id) {
          setSwipedId(null);
        }
      }
      
      setDragState({ active: false, id: null, type: null, startY: 0, currentY: 0, startX: 0, currentX: 0, initialY: 0 });
    };

    if (dragState.active) {
      window.addEventListener('pointermove', handlePointerMove, { passive: false });
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, swipedId]);

  const handleTaskPointerDown = (e, id, initialY) => {
    e.stopPropagation();
    if (e.target.closest('.action-btn')) return; // Don't drag if clicking buttons
    
    // Close other swiped items
    if (swipedId !== id && swipedId !== null) setSwipedId(null);

    setDragState({
      active: true,
      id,
      type: null,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      initialY
    });
  };

  const handleContainerClick = (e) => {
    if (dragState.type) return; // Don't trigger if we were dragging
    if (swipedId) {
      setSwipedId(null);
      return;
    }
    
    const rect = containerRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const snappedY = Math.floor(clickY / GRID_SIZE) * GRID_SIZE;
    
    setModalY(snappedY);
    setModalOpen(true);
  };

  const handleMarkerTimeChange = (type) => {
    const newTime = prompt(`Novo horário para ${markers[type].label} (HH:MM):`, markers[type].time);
    if (newTime && /^\d{2}:\d{2}$/.test(newTime)) {
      setMarkers(prev => ({
        ...prev,
        [type]: { ...prev[type], time: newTime }
      }));
    }
  };

  const handleDeleteTask = (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    setSwipedId(null);
  };

  const handleStartTimerConfig = (task) => {
    setSelectedTaskForTimer(task);
    setTimerModalOpen(true);
    setSwipedId(null);
  };

  const TaskItem = ({ task }) => {
    const isDragging = dragState.active && dragState.id === task.id && dragState.type === 'drag';
    const isSwiping = dragState.active && dragState.id === task.id && dragState.type === 'swipe';
    const isSwiped = swipedId === task.id;

    let y = task.yPos;
    let x = 0;

    if (isDragging) y = task.yPos + (dragState.currentY - dragState.startY);
    if (isSwiping) x = Math.max(-120, Math.min(0, dragState.currentX - dragState.startX + (isSwiped ? -120 : 0)));
    else if (isSwiped) x = -120;

    return (
      <div 
        className="absolute left-4 right-12 z-10 select-none touch-none"
        style={{ 
          top: `${y}px`, 
          height: `${GRID_SIZE - 4}px`, // Slight gap for visual separation
          zIndex: isDragging || isSwiping ? 50 : 10,
          transition: isDragging || isSwiping ? 'none' : 'top 0.2s ease, transform 0.2s ease'
        }}
        onPointerDown={(e) => handleTaskPointerDown(e, task.id, task.yPos)}
      >
        {/* Background Action Buttons */}
        <div className="absolute inset-y-0 right-0 flex items-center bg-gray-100 rounded-lg shadow-inner overflow-hidden" style={{ width: '120px' }}>
          <button 
            onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
            className="action-btn flex-1 h-full flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
          >
            <Trash2 size={20} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleStartTimerConfig(task); }}
            className="action-btn flex-1 h-full flex items-center justify-center bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors"
          >
            <Clock size={20} />
          </button>
        </div>

        {/* Main Draggable Task Card */}
        <div 
          className={`absolute inset-0 flex flex-col justify-center px-4 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing ${task.color.value}`}
          style={{ 
            transform: `translateX(${x}px)`,
            transition: isSwiping ? 'none' : 'transform 0.2s ease'
          }}
        >
          <div className="flex justify-between items-center w-full">
            <span className="font-medium truncate flex-1">{task.title}</span>
            {task.startTime && (
              <span className="text-xs opacity-70 ml-2 whitespace-nowrap">
                {task.startTime} {task.endTime ? `- ${task.endTime}` : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const TaskModal = () => {
    if (!modalOpen) return null;

    const handleSubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const newTask = {
        id: Date.now().toString(),
        title: fd.get('title'),
        desc: fd.get('desc'),
        color: COLORS[parseInt(fd.get('color'))],
        startTime: fd.get('startTime'),
        endTime: fd.get('endTime'),
        yPos: modalY
      };
      if (!newTask.title.trim()) return;
      setTasks(prev => [...prev, newTask]);
      setModalOpen(false);
    };

    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Nova Tarefa</h2>
            <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} className="text-gray-500"/></button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
              <input required name="title" autoFocus className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" placeholder="O que você vai fazer?" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <textarea name="desc" rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow resize-none" placeholder="Detalhes opcionais..." />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
                <input type="time" name="startTime" className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Término</label>
                <input type="time" name="endTime" className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
              <div className="flex gap-3">
                {COLORS.map((c, i) => (
                  <label key={c.name} className={`w-8 h-8 rounded-full cursor-pointer flex items-center justify-center shadow-sm border-2 ${c.value.split(' ')[0]} ${c.value.split(' ')[1]} relative`}>
                    <input type="radio" name="color" value={i} defaultChecked={i === 0} className="peer opacity-0 absolute inset-0 cursor-pointer" />
                    <div className="hidden peer-checked:block w-3 h-3 rounded-full bg-black/40"></div>
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="w-full mt-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Adicionar Tarefa
            </button>
          </form>
        </div>
      </div>
    );
  };

  const TimerModal = () => {
    if (!timerModalOpen) return null;
    
    const task = selectedTaskForTimer;

    const startCountdown = (mins) => {
      setTimer({ active: true, type: 'countdown', remainingSeconds: mins * 60, taskTitle: task.title, targetTime: null });
      setTimerModalOpen(false);
    };

    const startAlarm = () => {
      setTimer({ active: true, type: 'alarm', targetTime: task.endTime, taskTitle: task.title, remainingSeconds: 0 });
      setTimerModalOpen(false);
    };

    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setTimerModalOpen(false)}>
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
           <h3 className="text-lg font-bold text-gray-800 mb-2">Cronometrar Tarefa</h3>
           <p className="text-gray-600 mb-6 truncate">"{task?.title}"</p>

           <div className="space-y-3">
             <button onClick={() => startCountdown(25)} className="w-full py-3 px-4 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors flex items-center justify-between">
               <span>Foco: 25 minutos</span> <Play size={18} />
             </button>
             <button onClick={() => startCountdown(15)} className="w-full py-3 px-4 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors flex items-center justify-between">
               <span>Rápida: 15 minutos</span> <Play size={18} />
             </button>
             
             {task?.endTime && (
               <button onClick={startAlarm} className="w-full mt-2 py-3 px-4 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 font-medium transition-colors flex items-center justify-between">
                 <span>Avisar às {task.endTime}</span> <Bell size={18} />
               </button>
             )}
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans overflow-hidden">
      
      {/* Top Timer Bar (Conditional) */}
      {timer.active && (
        <div className="bg-blue-600 text-white p-3 shadow-md z-40 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
             {timer.type === 'countdown' ? <Clock size={20} className="animate-pulse" /> : <Bell size={20} className="animate-bounce" />}
             <span className="font-semibold">{timer.type === 'countdown' ? formatDuration(timer.remainingSeconds) : `Alarme: ${timer.targetTime}`}</span>
          </div>
          <div className="text-sm opacity-90 truncate max-w-[50%] mr-4">{timer.taskTitle}</div>
          <button onClick={() => setTimer({ active: false })} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4 shrink-0 shadow-sm z-30">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <AlignJustify size={24} className="text-blue-500" />
            Organizador de Tarefas
          </h1>
          <span className="text-gray-500 font-medium">{formatTime(currentTime)}</span>
        </div>
      </header>

      {/* Main Grid Canvas */}
      <div className="flex-1 relative overflow-y-auto overflow-x-hidden touch-pan-y" onClick={handleContainerClick}>
        
        {/* Ruled Background */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(transparent ${GRID_SIZE - 1}px, #e5e7eb ${GRID_SIZE - 1}px)`,
            backgroundSize: `100% ${GRID_SIZE}px`,
          }}
        />

        {/* Content Container (scrollable height based on needs, let's use a tall min-height) */}
        <div 
          ref={containerRef} 
          className="relative w-full min-h-[1200px]"
        >
          
          {/* Time Indicator Dot (Right side) */}
          <div className="absolute right-3 w-4 h-full pointer-events-none z-20">
            <div 
              className="absolute w-4 h-4 bg-blue-500 rounded-full shadow-md shadow-blue-500/50 transition-all duration-1000 ease-in-out z-30 ring-4 ring-blue-100"
              style={{ top: `${dotYPosition}px`, transform: 'translateY(-50%)' }}
            >
               {/* Pulsing effect */}
               <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75"></div>
            </div>
            {/* Subtle line connecting markers */}
            <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-gray-200 -z-10"></div>
          </div>

          {/* Markers */}
          <div 
            className="absolute left-4 z-20 flex items-center gap-2 cursor-pointer group"
            style={{ top: `${markers.start.yPos}px`, height: `${GRID_SIZE}px`, transform: 'translateY(-100%)' }}
            onClick={(e) => { e.stopPropagation(); handleMarkerTimeChange('start'); }}
          >
            <div className="w-2 h-2 rounded-full bg-gray-400 group-hover:bg-blue-500 transition-colors"></div>
            <span className="text-sm font-semibold text-gray-500 group-hover:text-blue-600 transition-colors border-b border-dashed border-transparent group-hover:border-blue-300">
              {markers.start.label} ({markers.start.time})
            </span>
          </div>

          <div 
            className="absolute left-4 z-20 flex items-center gap-2 cursor-pointer group"
            style={{ top: `${markers.end.yPos}px`, height: `${GRID_SIZE}px` }}
            onClick={(e) => { e.stopPropagation(); handleMarkerTimeChange('end'); }}
          >
            <div className="w-2 h-2 rounded-full bg-gray-400 group-hover:bg-blue-500 transition-colors"></div>
            <span className="text-sm font-semibold text-gray-500 group-hover:text-blue-600 transition-colors border-b border-dashed border-transparent group-hover:border-blue-300">
              {markers.end.label} ({markers.end.time})
            </span>
          </div>

          {/* Render Tasks */}
          {tasks.map(task => (
            <TaskItem key={task.id} task={task} />
          ))}

        </div>
      </div>

      {/* Modals */}
      <TaskModal />
      <TimerModal />

    </div>
  );
}