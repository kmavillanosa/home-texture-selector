import type { CSSProperties } from 'react'
import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'

interface NotesPadProps {
	value: string
	onChange: (next: string) => void
	disabled?: boolean
	ariaLabel: string
	className?: string
	style?: CSSProperties
}

export function NotesPad({
	value,
	onChange,
	disabled = false,
	ariaLabel,
	className,
	style,
}: NotesPadProps) {
	const editor = useEditor({
		extensions: [StarterKit, Underline],
		content: value,
		editable: !disabled,
		editorProps: {
			attributes: {
				class:
					'min-h-[180px] w-full whitespace-pre-wrap px-3 py-2 text-[11px] leading-relaxed text-slate-700 outline-none dark:text-slate-100 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-1',
			},
		},
		onUpdate: ({ editor: current }) => {
			onChange(current.getHTML())
		},
	})

	useEffect(() => {
		if (!editor) return
		editor.setEditable(!disabled)
	}, [editor, disabled])

	useEffect(() => {
		if (!editor) return
		if (editor.isFocused) return
		if (editor.getHTML() !== value) {
			editor.commands.setContent(value, { emitUpdate: false })
		}
	}, [editor, value])

	if (!editor) return null

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-1 text-[10px] text-slate-500">
				<button
					type="button"
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => editor.chain().focus().toggleBold().run()}
					className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${
						editor.isActive('bold')
							? 'border-emerald-500 bg-emerald-50 text-emerald-700'
							: 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
					}`}
					disabled={disabled}
					aria-label="bold"
				>
					B
				</button>
				<button
					type="button"
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => editor.chain().focus().toggleItalic().run()}
					className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${
						editor.isActive('italic')
							? 'border-emerald-500 bg-emerald-50 text-emerald-700'
							: 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
					}`}
					disabled={disabled}
					aria-label="italic"
				>
					I
				</button>
				<button
					type="button"
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => editor.chain().focus().toggleUnderline().run()}
					className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${
						editor.isActive('underline')
							? 'border-emerald-500 bg-emerald-50 text-emerald-700'
							: 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
					}`}
					disabled={disabled}
					aria-label="underline"
				>
					U
				</button>
				<button
					type="button"
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => editor.chain().focus().toggleBulletList().run()}
					className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${
						editor.isActive('bulletList')
							? 'border-emerald-500 bg-emerald-50 text-emerald-700'
							: 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
					}`}
					disabled={disabled}
					aria-label="bullets"
				>
					•
				</button>
				<button
					type="button"
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => editor.chain().focus().toggleOrderedList().run()}
					className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${
						editor.isActive('orderedList')
							? 'border-emerald-500 bg-emerald-50 text-emerald-700'
							: 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
					}`}
					disabled={disabled}
					aria-label="numbered list"
				>
					1.
				</button>
			</div>
			<div
				className={`relative ${className ?? ''}`}
				style={style}
				role="textbox"
				aria-label={ariaLabel}
			>
				<EditorContent editor={editor} className="h-full w-full" />
			</div>
		</div>
	)
}
