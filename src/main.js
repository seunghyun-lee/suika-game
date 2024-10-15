import './styles.css';
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { firebaseConfig } from './firebase';
import { initGame, handleRestartClick, toggleMute, showLeaderboard, hideLeaderboard } from './game';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

window.addEventListener('load', () => {
    initGame(database);
});

// 전역 객체에 함수들을 할당
window.handleRestartClick = handleRestartClick;
window.toggleMute = toggleMute;
window.showLeaderboard = showLeaderboard;
window.hideLeaderboard = hideLeaderboard;