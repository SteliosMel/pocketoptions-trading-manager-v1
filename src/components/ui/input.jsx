
import React from 'react'
export function Input(props){
  const cls='w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100'
  return <input className={cls} {...props}/>
}
