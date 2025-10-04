
import React from 'react'
export function Switch({checked,onCheckedChange}){
  return (<label className="inline-flex items-center cursor-pointer">
    <input type="checkbox" className="sr-only" checked={checked} onChange={e=>onCheckedChange(e.target.checked)}/>
    <span className={`w-10 h-6 flex items-center bg-gray-300 dark:bg-gray-700 rounded-full p-1 transition ${checked?'bg-blue-600':''}`}>
      <span className={`bg-white w-4 h-4 rounded-full shadow transform transition ${checked?'translate-x-4':''}`}></span>
    </span>
  </label>)
}
