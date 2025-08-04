'use client'

import React from 'react'

const variants = {
  primary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  outline: 'bg-transparent border border-emerald-600 text-emerald-600 hover:bg-emerald-50',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-800'
}

const sizes = {
  sm: 'py-1 px-2 text-sm',
  md: 'py-2 px-4 text-base',
  lg: 'py-3 px-6 text-lg'
}

export default function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  onClick,
  ...props
}) {
  return (
    <button
      type={type}
      className={}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
}
