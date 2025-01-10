'use client'

import { Input } from "@/components/ui/input"
import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { debounce } from "lodash-es"

interface MathContent {
  id: number
  content: string
  updated_at: string
}

export default function Home() {
  const [content, setContent] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const lastUpdateRef = useRef<string>('')

  const updateContent = async (newContent: string) => {
    try {
      lastUpdateRef.current = newContent
      const { error } = await supabase
        .from('math_content')
        .update({ content: newContent })
        .eq('id', 1)
      
      if (error) throw error
      setIsSaving(false)
    } catch (error) {
      console.error('Error updating content:', error)
      setIsSaving(false)
    }
  }

  // Debounced update for typing
  const debouncedUpdate = useCallback(
    debounce(updateContent, 200),
    []
  )

  useEffect(() => {
    // Initial fetch of content
    const fetchInitialContent = async () => {
      const { data, error } = await supabase
        .from('math_content')
        .select('content')
        .eq('id', 1)
        .single()
      
      if (error) {
        console.error('Error fetching content:', error)
        return
      }
      
      const initialContent = data?.content ?? ''
      setContent(initialContent)
      lastUpdateRef.current = initialContent
    }

    fetchInitialContent()

    // Subscribe to realtime changes
    const channel = supabase
      .channel('math_content')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'math_content',
          filter: 'id=eq.1'
        },
        (payload) => {
          const newContent = (payload.new as MathContent).content
          // Only update if it's different from our last update
          if (newContent !== lastUpdateRef.current) {
            setContent(newContent)
            lastUpdateRef.current = newContent
          }
        }
      )
      .subscribe()

    // Cleanup subscription and debounced function
    return () => {
      supabase.removeChannel(channel)
      debouncedUpdate.cancel()
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newContent = e.target.value
    setContent(newContent)
    setIsSaving(true)
    debouncedUpdate(newContent)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-sm space-y-2">
        <div className="relative">
          <Input 
            type="text" 
            placeholder="Type something..." 
            value={content}
            onChange={handleInputChange}
          />
          {isSaving && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              Saving...
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
