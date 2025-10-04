
import React from 'react'
const base='inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition border'
const variants={
  default:'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
  outline:'bg-transparent text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-gray-100/50 dark:hover:bg-gray-800/50',
  destructive:'bg-rose-600 text-white border-rose-600 hover:bg-rose-700',
  secondary:'bg-gray-200 text-gray-900 border-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600'
}
export function Button({variant='default', className='', ...props}){
  return <button className={`${base} ${variants[variant]||variants.default} ${className}`} {...props}/>
}
