import React, { useState, useEffect, useRef } from 'react'
import io from 'socket.io-client'

const socket = io({
  transports: ['polling', 'websocket']
})

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [onlineUsers, setOnlineUsers] = useState([])

  useEffect(() => {
    socket.on('receive_message', (data) => {
      setMessages((prev) => [...prev, data])
    })

    socket.on('presence_update', (data) => {
      setOnlineUsers(data.online)
    })

    return () => {
      socket.off('receive_message')
      socket.off('presence_update')
    }
  }, [])

  const sendMessage = (e) => {
    e.preventDefault()
    if (input.trim()) {
      socket.emit('send_message', { content: input, group_id: 1 }) // Example group_id
      setInput('')
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-white border-r">
        <div className="p-4 border-b font-bold text-xl">SHK Connect</div>
        <div className="p-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Online Users</h3>
          <ul className="space-y-2">
            {onlineUsers.map((user, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm">{user.username}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b flex items-center px-6">
          <h2 className="font-bold">General Chat</h2>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center font-bold">
                {msg.username[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{msg.username}</span>
                  <span className="text-xs text-gray-400">{msg.timestamp}</span>
                </div>
                <div className="bg-white p-3 rounded-xl shadow-sm mt-1 text-sm border">
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
        </div>

        <footer className="p-4 bg-white border-t">
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-gray-100 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">Send</button>
          </form>
        </footer>
      </div>
    </div>
  )
}

export default App
