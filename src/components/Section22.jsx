import React from 'react';
import AIPeerReviewGemini from './AIPeerReviewGemini';

export default function Section22({ isActive }) {
    return (
        <div className={`w-full h-full transition-opacity duration-1000 ${isActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
            {isActive && <AIPeerReviewGemini />}
        </div>
    );
}
