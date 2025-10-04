
import React from 'react'
export function Card({className='',...props}){ return <div className={`rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 ${className}`} {...props}/> }
export function CardContent({className='',...props}){ return <div className={`card-content ${className}`} {...props}/> }
