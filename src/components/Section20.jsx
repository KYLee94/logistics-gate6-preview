import React from 'react';
import Notes from './Notes';

export default function Section20({ isActive }) {
    return (
        <div className={`w-full h-full transition-opacity duration-1000 ${isActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
            {isActive && <Notes />}
        </div>
    );
}
