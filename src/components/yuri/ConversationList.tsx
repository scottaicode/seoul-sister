'use client'

import { useEffect, useState, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { MessageCircle, Plus, ChevronLeft, Pencil, Trash2, Check, X } from 'lucide-react'
import SpecialistBadge from './SpecialistBadge'
import type { ConversationSummary } from '@/types/yuri'

interface ConversationListProps {
  conversations: ConversationSummary[]
  currentConversationId: string | null
  onSelect: (conversationId: string) => void
  onNew: () => void
  onClose: () => void
  onLoad: () => void
  onDelete: (conversationId: string) => Promise<void>
  onRename: (conversationId: string, title: string) => Promise<void>
}

export default function ConversationList({
  conversations,
  currentConversationId,
  onSelect,
  onNew,
  onClose,
  onLoad,
  onDelete,
  onRename,
}: ConversationListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    onLoad()
  }, [onLoad])

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const handleStartEdit = (conv: ConversationSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(conv.id)
    setEditTitle(conv.title || '')
    setDeletingId(null)
  }

  const handleConfirmEdit = async (e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (editingId && editTitle.trim()) {
      await onRename(editingId, editTitle.trim())
    }
    setEditingId(null)
    setEditTitle('')
  }

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(null)
    setEditTitle('')
  }

  const handleStartDelete = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(convId)
    setEditingId(null)
  }

  const handleConfirmDelete = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await onDelete(convId)
    setDeletingId(null)
  }

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(null)
  }

  return (
    <div className="flex flex-col h-full bg-white/10 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-white/40 hover:text-white transition-colors"
          aria-label="Close conversation list"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <h2 className="font-display font-semibold text-sm text-white">
          Conversations
        </h2>
        <button
          onClick={onNew}
          className="flex items-center gap-1 text-sm text-gold hover:text-gold transition-colors"
          aria-label="New conversation"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <MessageCircle className="w-10 h-10 text-white/30 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-white/40">No conversations yet</p>
            <p className="text-xs text-white/30 mt-1">Start chatting with Yuri!</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/10">
            {conversations.map((conv) => {
              const isActive = conv.id === currentConversationId
              const isEditing = editingId === conv.id
              const isDeleting = deletingId === conv.id

              return (
                <li key={conv.id} className="group relative">
                  {/* Delete confirmation overlay */}
                  {isDeleting && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-red-950/80 backdrop-blur-sm px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-300">Delete?</span>
                        <button
                          onClick={(e) => handleConfirmDelete(conv.id, e)}
                          className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                          aria-label="Confirm delete"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={handleCancelDelete}
                          className="p-1.5 rounded bg-white/10 text-white/50 hover:bg-white/20 transition-colors"
                          aria-label="Cancel delete"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (!isEditing && !isDeleting) {
                        onSelect(conv.id)
                        onClose()
                      }
                    }}
                    className={`w-full text-left px-4 py-3 transition-colors duration-200 hover:bg-white/5 ${
                      isActive ? 'bg-gold/10' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <form onSubmit={handleConfirmEdit} className="flex items-center gap-1.5">
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-white/10 border border-gold/30 rounded px-2 py-0.5 text-sm text-white outline-none focus:border-gold/60"
                              maxLength={200}
                            />
                            <button
                              type="submit"
                              onClick={handleConfirmEdit}
                              className="p-1 rounded text-gold hover:bg-gold/10 transition-colors flex-shrink-0"
                              aria-label="Save title"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="p-1 rounded text-white/40 hover:bg-white/10 transition-colors flex-shrink-0"
                              aria-label="Cancel edit"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        ) : (
                          <p className="font-medium text-sm text-white truncate">
                            {conv.title || 'New conversation'}
                          </p>
                        )}
                        {conv.specialist_type && !isEditing && (
                          <div className="mt-1">
                            <SpecialistBadge type={conv.specialist_type} size="sm" />
                          </div>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <div className="flex items-center gap-0.5">
                            {/* Action buttons - visible on hover/touch */}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => handleStartEdit(conv, e)}
                                className="p-1 rounded text-white/30 hover:text-gold hover:bg-gold/10 transition-colors"
                                aria-label="Rename conversation"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => handleStartDelete(conv.id, e)}
                                className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                aria-label="Delete conversation"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="text-[10px] text-white/40 ml-1">
                              {formatDistanceToNow(new Date(conv.updated_at), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                          <span className="text-[10px] text-white/30">
                            {conv.message_count} msg{conv.message_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
