


import React, { useState, useCallback, useRef, useEffect } from 'react';
// FIX: Renamed Blob to GenaiBlob to avoid conflict with the browser's native Blob type.
import { GoogleGenAI, Chat, GenerateContentResponse, LiveServerMessage, Modality, Blob as GenaiBlob } from "@google/genai";
import type { Message, AspectRatio } from './types';
import { MessageAuthor } from './types';

// --- HELPER FUNCTIONS ---
const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
});

const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
});

const LoadingSpinner: React.FC<{className?: string}> = ({ className = 'w-5 h-5' }) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const CodeBlock: React.FC<{ code: string }> = ({ code }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-gray-800 rounded-md my-4">
            <div className="flex justify-between items-center px-4 py-2 bg-gray-700 rounded-t-md">
                <span className="text-sm text-gray-400">code</span>
                <button onClick={handleCopy} className="text-sm text-gray-300 hover:text-white focus:outline-none">
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <pre className="p-4 overflow-x-auto"><code className="text-sm">{code}</code></pre>
        </div>
    );
};


const renderMessageText = (text: string) => {
    const parts = text.split(/(\`\`\`[\s\S]*?\`\`\`)/g);
    return parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
            const code = part.slice(3, -3).trim();
            return <CodeBlock key={index} code={code} />;
        }
        return <p key={index} className="whitespace-pre-wrap">{part}</p>;
    });
};

const Tooltip: React.FC<{ text: string; children: React.ReactNode; }> = ({ text, children }) => {
    return (
        <div className="relative group">
            {children}
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max whitespace-nowrap px-2 py-1 bg-gray-800 border border-gray-700 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                {text}
            </span>
        </div>
    );
};

// --- ICONS ---
// FIX: Changed JSX.Element to React.ReactElement to resolve "Cannot find namespace 'JSX'" error.
// FIX: Explicitly set the generic type of ReactElement to `any` to fix type inference issue with `React.cloneElement`.
const Icons: { [key: string]: React.ReactElement<any> } = {
    spark: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>,
    movie: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3h-15Zm-1.5 3a1.5 1.5 0 0 1 1.5-1.5h15a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-15a1.5 1.5 0 0 1-1.5-1.5v-9Z" /><path d="M18.97 8.97a.75.75 0 0 1 1.06 0l1.5 1.5a.75.75 0 0 1 0 1.06l-1.5 1.5a.75.75 0 1 1-1.06-1.06l.97-.97-.97-.97a.75.75 0 0 1 0-1.06Zm-15 0a.75.75 0 0 1 0 1.06l.97.97-.97.97a.75.75 0 0 1-1.06 1.06l-1.5-1.5a.75.75 0 0 1 0-1.06l1.5-1.5a.75.75 0 0 1 1.06 0Z" /></svg>,
    voice_chat: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.15l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.15 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z" clipRule="evenodd" /></svg>,
    image: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06l4.47-4.47a.75.75 0 0 1 1.06 0l3.97 3.97 2.47-2.47a.75.75 0 0 1 1.06 0l4.47 4.47V6.75A.75.75 0 0 0 19.5 6H4.5a.75.75 0 0 0-.75.75v9.31Z" clipRule="evenodd" /></svg>,
    video_spark: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M9.303 3.303a1.5 1.5 0 0 0-2.12 2.121l1.413 1.414-2.483 2.483-1.414-1.414a1.5 1.5 0 0 0-2.121 2.12l1.414 1.414-1.472 1.472a1.5 1.5 0 0 0 2.121 2.121l1.472-1.472 1.414 1.414a1.5 1.5 0 0 0 2.12-2.121l-1.413-1.414 2.483-2.483 1.414 1.414a1.5 1.5 0 0 0 2.121-2.12l-1.414-1.414 1.472-1.472a1.5 1.5 0 0 0-2.121-2.121l-1.472 1.472-1.414-1.414Z" /><path d="m11.53 2.22-.353.353.353.354a1.5 1.5 0 0 0-2.121-2.121l-.354.353-.353-.353a1.5 1.5 0 0 0 2.12-2.121l.353.353.354-.353a1.5 1.5 0 0 0 2.121 2.12l-.353.354.353.353a1.5 1.5 0 0 0 2.121 2.121l-.353-.353.353-.354a1.5 1.5 0 0 0-2.12-2.121l.353-.353-.354-.353a1.5 1.5 0 0 0-2.12-2.12Z" /><path d="M19.953 9.453a1.5 1.5 0 0 0-2.121-2.121l-.353.353-.354-.353a1.5 1.5 0 0 0-2.121 2.12l.353.354-.353.353a1.5 1.5 0 0 0 2.12 2.121l.354-.353.353.353a1.5 1.5 0 0 0 2.121-2.12l-.353-.354.353-.353Z" /></svg>,
    live_audio: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 2.25a.75.75 0 0 1 .75.75v18a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75Z" /><path d="M4.5 9a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 4.5 9Zm15 0a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5a.75.75 0 0 1 .75-.75Z" /><path d="M8.25 6a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-1.5 0V6.75A.75.75 0 0 1 8.25 6Zm7.5 0a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-1.5 0V6.75a.75.75 0 0 1 .75-.75Z" /></svg>,
    mic: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" /><path d="M6 12.75A.75.75 0 0 1 6.75 12h10.5a.75.75 0 0 1 0 1.5H6.75A.75.75 0 0 1 6 12.75ZM12 15.75a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5a.75.75 0 0 1 .75-.75Z" /></svg>,
    image_edit_auto: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06l4.47-4.47a.75.75 0 0 1 1.06 0l3.97 3.97L19.5 7.78a.75.75 0 0 1 1.06 0l2.22 2.22v6.06a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1-.75-.75V16.06Z" clipRule="evenodd" /><path d="M17.25 2.25a.75.75 0 0 0-1.06 1.06l.94.94-.94.94a.75.75 0 1 0 1.06 1.06l.94-.94.94.94a.75.75 0 1 0 1.06-1.06l-.94-.94.94-.94a.75.75 0 0 0-1.06-1.06l-.94.94-.94-.94Z"/></svg>,
    speech_to_text: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M15.003 17.155A4.502 4.502 0 0 1 12 18c-1.83 0-3.412-.993-4.14-2.426-1.144-.312-2.145-1.028-2.78-2.021a.75.75 0 0 1 1.258-.788c.49.79 1.25 1.34 2.146 1.587A4.5 4.5 0 0 1 12 15a4.488 4.488 0 0 1 2.855.997c.901-.246 1.66-.798 2.147-1.588a.75.75 0 1 1 1.258.788c-.636.993-1.637 1.709-2.78 2.021ZM12 4.5a3.75 3.75 0 0 0-3.75 3.75v6a3.75 3.75 0 0 0 7.5 0v-6A3.75 3.75 0 0 0 12 4.5Z" /></svg>,
    audio_spark: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M3.515 9.375a.75.75 0 0 0-1.06 0 3.998 3.998 0 0 0 0 5.654.75.75 0 0 0 1.06-1.06 2.5 2.5 0 0 1 0-3.535.75.75 0 0 0 0-1.06Zm3.182-3.181a.75.75 0 0 0-1.061 0 8.003 8.003 0 0 0 0 11.312.75.75 0 0 0 1.06-1.06 6.5 6.5 0 0 1 0-9.192.75.75 0 0 0 0-1.06ZM12 8.25a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 .75-.75Zm8.937-2.937a.75.75 0 0 0-1.06 1.06 6.5 6.5 0 0 1 0 9.192.75.75 0 1 0 1.06 1.06 8.003 8.003 0 0 0 0-11.312.75.75 0 0 0 0-1.06Zm-3.181 3.181a.75.75 0 0 0-1.06 1.06 2.5 2.5 0 0 1 0 3.535.75.75 0 1 0 1.06 1.06 3.998 3.998 0 0 0 0-5.654.75.75 0 0 0 0-1.06Z" /><path d="M12.44 2.19a.75.75 0 0 0-1.06.02l-2.5 2.75a.75.75 0 0 0 1.08 1.04l2.5-2.75a.75.75 0 0 0-.02-1.06Zm7.313 7.313a.75.75 0 0 0-1.04 1.08l2.75 2.5a.75.75 0 0 0 1.06-.02l-2.77-2.56Z" /></svg>
};

// --- API KEY SELECTOR COMPONENT ---
const ApiKeySelector: React.FC<{ onKeySelected: () => void }> = ({ onKeySelected }) => {
    const handleSelectKey = async () => {
        try {
            await (window as any).aistudio.openSelectKey();
            onKeySelected();
        } catch (e) {
            console.error("Error opening key selector:", e);
        }
    };

    return (
        <div className="bg-blue-900/50 border border-blue-600 text-blue-200 px-6 py-4 rounded-lg relative my-4 max-w-lg text-center" role="alert">
            <div className="flex justify-center mb-3">
              <Tooltip text="Veo Video Generation Model">
                {React.cloneElement(Icons.spark, { className: "w-8 h-8 text-blue-400" })}
              </Tooltip>
            </div>
            <strong className="font-bold text-lg">Enable Video Generation</strong>
            <p className="text-sm mt-2">
                To generate videos, you need to connect a Google Cloud project with billing enabled. This allows the use of the powerful Veo model.
            </p>
             <p className="text-xs text-blue-300 mt-2">
                Your API key is securely managed and will be automatically used for requests.
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline ml-1 hover:text-blue-100">Learn more about billing.</a>
            </p>
            <div className="mt-5">
                <button
                    onClick={handleSelectKey}
                    className="bg-blue-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-blue-500 transition-colors flex items-center justify-center w-full"
                >
                    Connect Project and Select API Key
                </button>
            </div>
        </div>
    );
};

// --- CHATBOT COMPONENT ---
const Chatbot: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chat, setChat] = useState<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const newChat = ai.chats.create({ model: 'gemini-2.5-flash' });
        setChat(newChat);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isLoading || !chat) return;

        const userMessage: Message = { author: MessageAuthor.USER, text: prompt };
        setMessages(prev => [...prev, userMessage]);
        setPrompt('');
        setIsLoading(true);

        try {
            const responseStream = await chat.sendMessageStream({ message: prompt });
            let modelResponse = '';
            setMessages(prev => [...prev, { author: MessageAuthor.MODEL, text: '...' }]);

            for await (const chunk of responseStream) {
                modelResponse += chunk.text;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].text = modelResponse;
                    return newMessages;
                });
            }
        } catch (error) {
            console.error("Gemini API error:", error);
            setMessages(prev => [...prev, { author: MessageAuthor.MODEL, text: "Sorry, I couldn't get a response. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="h-full flex flex-col">
            <div className="flex-grow overflow-y-auto p-6 space-y-6">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-4 ${msg.author === MessageAuthor.USER ? 'justify-end' : ''}`}>
                        {msg.author === MessageAuthor.MODEL && (
                           <Tooltip text="Gemini">
                             <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">{Icons.spark}</div>
                           </Tooltip>
                        )}
                         <div className={`max-w-xl rounded-lg px-4 py-3 ${msg.author === MessageAuthor.USER ? 'bg-blue-600' : 'bg-gray-700'}`}>
                            <div className="prose prose-invert prose-sm">{renderMessageText(msg.text)}</div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-gray-700">
                <form onSubmit={handleSubmit} className="flex gap-4">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ask me anything..."
                        disabled={isLoading}
                        className="flex-grow bg-gray-800 border border-gray-600 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center">
                        {isLoading ? <LoadingSpinner /> : 'Send'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- IMAGE GENERATOR COMPONENT ---
const ImageGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        setIsLoading(true);
        setImageUrl('');
        setError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: prompt,
                config: { numberOfImages: 1, outputMimeType: 'image/png' },
            });
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            setImageUrl(`data:image/png;base64,${base64ImageBytes}`);
        } catch (err) {
            console.error("Image generation error:", err);
            setError("Failed to generate image. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-6 h-full flex flex-col">
            <form onSubmit={handleSubmit} className="flex-shrink-0 mb-6">
                <div className="flex gap-4">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., A futuristic city skyline at sunset"
                        disabled={isLoading}
                        className="flex-grow bg-gray-800 border border-gray-600 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center justify-center w-32">
                        {isLoading ? <LoadingSpinner /> : 'Generate'}
                    </button>
                </div>
            </form>
            <div className="flex-grow bg-gray-800/50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-600">
                {isLoading && <div className="text-center"><LoadingSpinner className="w-12 h-12 mx-auto mb-4" /><p>Generating your masterpiece...</p></div>}
                {error && <p className="text-red-400">{error}</p>}
                {!isLoading && imageUrl && <img src={imageUrl} alt="Generated" className="max-h-full max-w-full object-contain rounded-md" />}
                {!isLoading && !imageUrl && !error && <p className="text-gray-400">Your generated image will appear here</p>}
            </div>
        </div>
    );
};

// --- IMAGE EDITOR COMPONENT ---
const ImageEditor: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [originalImageFile, setOriginalImageFile] = useState<File | null>(null);
    const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
    const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 4 * 1024 * 1024) {
                setError("File size exceeds 4MB limit.");
                return;
            }
            setOriginalImageFile(file);
            setOriginalImageUrl(URL.createObjectURL(file));
            setEditedImageUrl(null); // Clear previous edit on new image
            setError('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || !originalImageFile) {
            setError("Please upload an image and provide an editing prompt.");
            return;
        }

        setIsLoading(true);
        setEditedImageUrl(null);
        setError('');
        try {
            const base64Image = await fileToBase64(originalImageFile);
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        { inlineData: { data: base64Image, mimeType: originalImageFile.type } },
                        { text: prompt },
                    ],
                },
                config: { responseModalities: [Modality.IMAGE] },
            });

            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart?.inlineData) {
                const base64Bytes = imagePart.inlineData.data;
                setEditedImageUrl(`data:${imagePart.inlineData.mimeType};base64,${base64Bytes}`);
            } else {
                throw new Error("No image was returned from the model.");
            }

        } catch (err: any) {
            console.error("Image editing error:", err);
            setError(`Failed to edit image. ${err.message || 'Please try again.'}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <form onSubmit={handleSubmit} className="flex-shrink-0 mb-6">
                <div
                    className="w-full h-40 bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-600 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-colors mb-4"
                    onClick={() => inputRef.current?.click()}
                >
                    <input type="file" ref={inputRef} onChange={handleFileChange} accept="image/png, image/jpeg" className="hidden" />
                    {originalImageUrl ? (
                        <p className="text-sm text-gray-300">Image selected. Click to change.</p>
                    ) : (
                         <>
                            <Tooltip text="Upload Image">{Icons.image}</Tooltip>
                            <p className="mt-2 text-sm text-gray-400">Click to upload an image to edit (PNG, JPG, max 4MB)</p>
                        </>
                    )}
                </div>
                <div className="flex gap-4">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., Add a retro filter, make the background blurry"
                        disabled={isLoading}
                        className="flex-grow bg-gray-800 border border-gray-600 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="submit" disabled={isLoading || !originalImageFile} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center justify-center w-32">
                        {isLoading ? <LoadingSpinner /> : 'Edit'}
                    </button>
                </div>
            </form>
             <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800/50 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-600 p-2">
                    <h3 className="text-lg font-semibold mb-2 text-gray-400">Original</h3>
                    <div className="flex-grow flex items-center justify-center w-full h-full">
                       {originalImageUrl && <img src={originalImageUrl} alt="Original" className="max-h-full max-w-full object-contain rounded-md" />}
                       {!originalImageUrl && <p className="text-gray-500">Upload an image to start</p>}
                    </div>
                </div>
                <div className="bg-gray-800/50 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-600 p-2">
                    <h3 className="text-lg font-semibold mb-2 text-gray-400">Edited</h3>
                    <div className="flex-grow flex items-center justify-center w-full h-full">
                        {isLoading && <div className="text-center"><LoadingSpinner className="w-12 h-12 mx-auto mb-4" /><p>Editing your image...</p></div>}
                        {!isLoading && error && <p className="text-red-400 p-4 text-center">{error}</p>}
                        {!isLoading && editedImageUrl && <img src={editedImageUrl} alt="Edited" className="max-h-full max-w-full object-contain rounded-md" />}
                        {!isLoading && !editedImageUrl && !error && <p className="text-gray-500">Your edited image will appear here</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- VIDEO GENERATOR BASE (for Prompt-to-Video and Image-to-Video) ---
const VeoGeneratorBase: React.FC<{
    title: string;
    generateFunction: (prompt: string, aspectRatio: AspectRatio) => Promise<string | null>;
    children?: React.ReactNode;
}> = ({ title, generateFunction, children }) => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
    const [videoUrl, setVideoUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [loadingMessage, setLoadingMessage] = useState('');

    const [isKeySelected, setIsKeySelected] = useState(false);
    const [isCheckingKey, setIsCheckingKey] = useState(true);

    const loadingMessages = [
        "Warming up the digital canvas...",
        "Gathering pixels and inspiration...",
        "Directing the digital actors...",
        "Rendering the first few frames...",
        "This can take a few minutes, hang tight!",
        "Applying cinematic magic...",
        "Finalizing the motion picture...",
    ];

    useEffect(() => {
        const checkApiKey = async () => {
            setIsCheckingKey(true);
            try {
                if (await (window as any).aistudio.hasSelectedApiKey()) {
                    setIsKeySelected(true);
                }
            } catch (e) {
                console.error("Error checking for API key", e);
            }
            setIsCheckingKey(false);
        };
        checkApiKey();
    }, []);

    useEffect(() => {
        let interval: number;
        if (isLoading) {
            let i = 0;
            setLoadingMessage(loadingMessages[i]);
            interval = window.setInterval(() => {
                i = (i + 1) % loadingMessages.length;
                setLoadingMessage(loadingMessages[i]);
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isLoading]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        setIsLoading(true);
        setVideoUrl('');
        setError('');
        
        try {
            const url = await generateFunction(prompt, aspectRatio);
            if (url) {
                setVideoUrl(url);
            } else {
                setError("Failed to generate video. The operation did not return a valid URL.");
            }
        } catch (err: any) {
            console.error(`${title} error:`, err);
            const errorMessage = err.message || JSON.stringify(err);
            if (errorMessage.includes("Requested entity was not found")) {
                setError("Your project may not be configured for video generation, or the API key is invalid. Please select a valid, billing-enabled project and API key.");
                setIsKeySelected(false);
            } else {
                setError(`Failed to generate video. Please try again. Error: ${err.message || 'Unknown error'}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeySelected = () => {
        setIsKeySelected(true);
        setError('');
    };

    if (isCheckingKey) {
        return (
            <div className="p-6 h-full flex flex-col items-center justify-center">
                <LoadingSpinner className="w-10 h-10" />
                <p className="mt-4 text-gray-400">Checking API key status...</p>
            </div>
        );
    }

    if (!isKeySelected) {
        return (
            <div className="p-6 h-full flex flex-col items-center justify-center">
                {error && <p className="text-red-400 p-4 text-center max-w-lg mb-4 bg-red-900/50 border border-red-600 rounded-lg">{error}</p>}
                <ApiKeySelector onKeySelected={handleKeySelected} />
            </div>
        );
    }
    
    return (
        <div className="p-6 h-full flex flex-col">
            <form onSubmit={handleSubmit} className="flex-shrink-0 mb-6">
                 {children}
                <div className="flex gap-4 mt-4">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe the video you want to create..."
                        disabled={isLoading}
                        className="flex-grow bg-gray-800 border border-gray-600 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center justify-center w-32">
                        {isLoading ? <LoadingSpinner /> : 'Generate'}
                    </button>
                </div>
                <div className="mt-4">
                    <span className="mr-4 font-semibold">Aspect Ratio:</span>
                    <label className="mr-4">
                        <input type="radio" name="aspectRatio" value="16:9" checked={aspectRatio === '16:9'} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} className="mr-1" />
                        16:9 (Landscape)
                    </label>
                    <label>
                        <input type="radio" name="aspectRatio" value="9:16" checked={aspectRatio === '9:16'} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} className="mr-1" />
                        9:16 (Portrait)
                    </label>
                </div>
            </form>
            <div className="flex-grow bg-gray-800/50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-600">
                {isLoading && <div className="text-center"><LoadingSpinner className="w-12 h-12 mx-auto mb-4" /><p className="mt-2 font-semibold text-lg">Generating Video...</p><p className="text-gray-300">{loadingMessage}</p></div>}
                {!isLoading && error && <p className="text-red-400 p-4 text-center">{error}</p>}
                {!isLoading && videoUrl && <video src={videoUrl} controls autoPlay loop className="max-h-full max-w-full object-contain rounded-md" />}
                {!isLoading && !videoUrl && !error && <p className="text-gray-400">Your generated video will appear here</p>}
            </div>
        </div>
    );
};

const VideoGenerator: React.FC = () => {
    const generateVideoFromPrompt = async (prompt: string, aspectRatio: AspectRatio) => {
        if (!prompt.trim()) {
            throw new Error("Prompt cannot be empty.");
        }
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: aspectRatio
            }
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }
        
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) return null;
        
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY as string}`);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    };
    
    return <VeoGeneratorBase title="Video Generation" generateFunction={generateVideoFromPrompt} />;
};

const ImageAnimator: React.FC = () => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageError, setImageError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 4 * 1024 * 1024) { // 4MB limit
                setImageError("File size exceeds 4MB limit.");
                return;
            }
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setImageError('');
        }
    };

    const generateVideoFromImage = async (prompt: string, aspectRatio: AspectRatio) => {
        if (!imageFile) {
            throw new Error("Please upload an image first.");
        }
        const base64Image = await fileToBase64(imageFile);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            image: {
                imageBytes: base64Image,
                mimeType: imageFile.type,
            },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: aspectRatio
            }
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }
        
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) return null;

        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY as string}`);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    };

    return (
        <VeoGeneratorBase title="Image Animation" generateFunction={generateVideoFromImage}>
            <div
                className="w-full h-48 bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-600 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-colors"
                onClick={() => inputRef.current?.click()}
            >
                <input type="file" ref={inputRef} onChange={handleFileChange} accept="image/png, image/jpeg" className="hidden" />
                {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="max-h-full max-w-full object-contain rounded" />
                ) : (
                    <>
                        <Tooltip text="Upload Image">{Icons.image}</Tooltip>
                        <p className="mt-2 text-sm text-gray-400">Click to upload an image (PNG, JPG, max 4MB)</p>
                    </>
                )}
            </div>
            {imageError && <p className="text-red-400 text-sm mt-2">{imageError}</p>}
        </VeoGeneratorBase>
    );
};


// --- LIVE CHAT COMPONENT ---
interface Transcript {
    author: 'user' | 'model';
    text: string;
}

const LiveChat: React.FC = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [transcripts, setTranscripts] = useState<Transcript[]>([]);
    const [currentUserText, setCurrentUserText] = useState('');
    const [currentModelText, setCurrentModelText] = useState('');
    
    // FIX: Replaced non-exported `LiveSession` type with `any`.
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const transcriptEndRef = useRef<HTMLDivElement>(null);
    
    // --- Audio encoding/decoding helpers ---
    const encode = (bytes: Uint8Array): string => {
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    };

    const decode = (base64: string): Uint8Array => {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    };
    
    const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
        const dataInt16 = new Int16Array(data.buffer);
        const frameCount = dataInt16.length / numChannels;
        const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const channelData = buffer.getChannelData(channel);
            for (let i = 0; i < frameCount; i++) {
                channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
            }
        }
        return buffer;
    };

    // FIX: Updated return type to use the aliased GenaiBlob type.
    const createBlob = (data: Float32Array): GenaiBlob => {
        const l = data.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
            int16[i] = data[i] * 32768;
        }
        return {
            data: encode(new Uint8Array(int16.buffer)),
            mimeType: 'audio/pcm;rate=16000',
        };
    };
    
    const stopSession = useCallback(async () => {
        if (sessionPromiseRef.current) {
            const session = await sessionPromiseRef.current;
            session.close();
            sessionPromiseRef.current = null;
        }

        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        
        scriptProcessorRef.current?.disconnect();
        scriptProcessorRef.current = null;
        
        audioContextRef.current?.close();
        audioContextRef.current = null;

        outputAudioContextRef.current?.close();
        outputAudioContextRef.current = null;

        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        
        setIsSessionActive(false);
        setIsConnecting(false);
    }, []);

    useEffect(() => {
        return () => {
            stopSession();
        };
    }, [stopSession]);

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcripts, currentUserText, currentModelText]);
    
    const startSession = async () => {
        setIsConnecting(true);
        setError(null);
        setTranscripts([]);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            nextStartTimeRef.current = 0;
            audioSourcesRef.current = new Set();
            
            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        const source = audioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;
                        
                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(audioContextRef.current!.destination);
                        
                        setIsConnecting(false);
                        setIsSessionActive(true);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        // Handle transcriptions
                        if (message.serverContent?.inputTranscription) {
                            setCurrentUserText(prev => prev + message.serverContent.inputTranscription.text);
                        } else if (message.serverContent?.outputTranscription) {
                            setCurrentModelText(prev => prev + message.serverContent.outputTranscription.text);
                        }

                        if (message.serverContent?.turnComplete) {
                            const finalUserText = currentUserText;
                            const finalModelText = currentModelText;
                            setTranscripts(prev => [
                                ...prev,
                                { author: 'user', text: finalUserText },
                                { author: 'model', text: finalModelText }
                            ]);
                            setCurrentUserText('');
                            setCurrentModelText('');
                        }

                        // Handle audio playback
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                        if (base64Audio) {
                            const outCtx = outputAudioContextRef.current!;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
                            const source = outCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outCtx.destination);
                            source.addEventListener('ended', () => {
                                audioSourcesRef.current.delete(source);
                            });
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }

                        if (message.serverContent?.interrupted) {
                            audioSourcesRef.current.forEach(source => source.stop());
                            audioSourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        setError(`Session error: ${e.message}`);
                        stopSession();
                    },
                    onclose: () => {
                        stopSession();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                    },
                },
            });
        } catch (err: any) {
            setError(`Failed to start session: ${err.message}`);
            setIsConnecting(false);
        }
    };
    
    const getStatusText = () => {
        if (isConnecting) return "Connecting...";
        if (isSessionActive) return "Live - Gemini is listening...";
        return "Click the mic to start the conversation";
    };
    
    return (
        <div className="h-full flex flex-col p-6">
            <div className="flex-grow overflow-y-auto mb-4 space-y-4 pr-2">
                {transcripts.map((t, i) => (
                    <div key={i} className={`flex items-start gap-3 ${t.author === 'user' ? 'justify-end' : ''}`}>
                        {t.author === 'model' && <Tooltip text="Gemini"><div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">{Icons.spark}</div></Tooltip>}
                        <div className={`max-w-xl rounded-lg px-4 py-2 ${t.author === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                            <p className="text-white">{t.text}</p>
                        </div>
                    </div>
                ))}
                {currentModelText && (
                    <div className="flex items-start gap-3">
                        <Tooltip text="Gemini">
                            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">{Icons.spark}</div>
                        </Tooltip>
                        <div className="max-w-xl rounded-lg px-4 py-2 bg-gray-700">
                             <p className="text-white opacity-70">{currentModelText}</p>
                        </div>
                    </div>
                )}
                 {currentUserText && (
                    <div className="flex items-start gap-3 justify-end">
                        <div className="max-w-xl rounded-lg px-4 py-2 bg-blue-600">
                             <p className="text-white opacity-70">{currentUserText}</p>
                        </div>
                    </div>
                )}
                <div ref={transcriptEndRef} />
            </div>

            <div className="flex-shrink-0 flex flex-col items-center justify-center pt-4 border-t border-gray-700">
                <Tooltip text={isSessionActive ? "Stop session" : "Start session"}>
                    <button
                        onClick={isSessionActive ? stopSession : startSession}
                        disabled={isConnecting}
                        className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${isSessionActive ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'} disabled:bg-gray-600 disabled:cursor-not-allowed`}
                        aria-label={isSessionActive ? "Stop session" : "Start session"}
                    >
                        {isConnecting ? <LoadingSpinner className="w-8 h-8"/> : <div className="text-white h-8 w-8">{Icons.mic}</div>}
                        {isSessionActive && !isConnecting && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                    </button>
                </Tooltip>
                <p className="mt-4 text-sm text-gray-400 h-5">{getStatusText()}</p>
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>
        </div>
    );
};

// --- AUDIO TRANSCRIBER COMPONENT ---
const AudioTranscriber: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [error, setError] = useState('');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const handleStartRecording = async () => {
        setError('');
        setTranscription('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };
            mediaRecorderRef.current.onstop = async () => {
                setIsLoading(true);
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                audioChunksRef.current = [];
                try {
                    const base64Audio = await blobToBase64(audioBlob);
                    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: {
                            parts: [
                                { inlineData: { data: base64Audio, mimeType: 'audio/webm' } },
                                { text: 'Transcribe this audio.' },
                            ],
                        },
                    });
                    setTranscription(response.text);
                } catch (err: any) {
                    console.error("Transcription error:", err);
                    setError(`Transcription failed. ${err.message || 'Please try again.'}`);
                } finally {
                    setIsLoading(false);
                }
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err: any) {
            setError(`Could not start recording: ${err.message}`);
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            // Get all tracks from the stream and stop them
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
        }
    };

    const getStatusText = () => {
        if (isLoading) return "Transcribing...";
        if (isRecording) return "Recording in progress...";
        return "Click the mic to start recording";
    };

    return (
        <div className="h-full flex flex-col p-6">
            <div className="flex-grow bg-gray-800/50 rounded-lg p-4 border-2 border-dashed border-gray-600 flex flex-col">
                <h3 className="text-lg font-semibold mb-2 text-gray-400">Transcription</h3>
                <div className="flex-grow overflow-y-auto prose prose-invert prose-sm max-w-none">
                    {transcription ? <p>{transcription}</p> : <p className="text-gray-500">Your transcript will appear here...</p>}
                </div>
            </div>

            <div className="flex-shrink-0 flex flex-col items-center justify-center pt-6 border-t border-gray-700 mt-6">
                <Tooltip text={isRecording ? "Stop recording" : "Start recording"}>
                     <button
                        onClick={isRecording ? handleStopRecording : handleStartRecording}
                        disabled={isLoading}
                        className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'} disabled:bg-gray-600 disabled:cursor-not-allowed`}
                        aria-label={isRecording ? "Stop recording" : "Start recording"}
                    >
                        {isLoading ? <LoadingSpinner className="w-8 h-8"/> : <div className="text-white h-8 w-8">{Icons.mic}</div>}
                        {isRecording && !isLoading && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                    </button>
                </Tooltip>
                <p className="mt-4 text-sm text-gray-400 h-5">{getStatusText()}</p>
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>
        </div>
    );
};

// --- SPEECH GENERATOR COMPONENT (TTS) ---
const SpeechGenerator: React.FC = () => {
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const audioContextRef = useRef<AudioContext | null>(null);

    // --- Audio decoding helpers from LiveChat ---
    const decode = (base64: string): Uint8Array => {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    };
    
    const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
        const dataInt16 = new Int16Array(data.buffer);
        const frameCount = dataInt16.length / numChannels;
        const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const channelData = buffer.getChannelData(channel);
            for (let i = 0; i < frameCount; i++) {
                channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
            }
        }
        return buffer;
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) {
            setError("Please enter some text to generate speech.");
            return;
        }
        setIsLoading(true);
        setError('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                    },
                },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) {
                throw new Error("Model did not return audio data.");
            }

            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            const ctx = audioContextRef.current;
            
            const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.start();

        } catch (err: any) {
            console.error("Speech generation error:", err);
            setError(`Failed to generate speech. ${err.message || 'Please try again.'}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <form onSubmit={handleSubmit} className="flex-shrink-0 mb-6 flex-grow flex flex-col">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter text here to convert to speech..."
                    disabled={isLoading}
                    className="flex-grow w-full bg-gray-800 border border-gray-600 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <div className="mt-4 flex flex-col items-center">
                    <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg transition-colors flex items-center justify-center w-64 h-14">
                        {isLoading ? <LoadingSpinner /> : 'Generate & Play Speech'}
                    </button>
                    {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
                </div>
            </form>
        </div>
    );
};

// --- MAIN APP COMPONENT ---
type Tab = 'chat' | 'live' | 'image' | 'imageEdit' | 'video' | 'animate' | 'speech' | 'transcribe';

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('chat');

    const tabs: { id: Tab; name: string; icon: string; component: React.FC }[] = [
        { id: 'chat', name: 'AI Chat', icon: 'voice_chat', component: Chatbot },
        { id: 'live', name: 'Live Chat', icon: 'live_audio', component: LiveChat },
        { id: 'image', name: 'Image Gen', icon: 'image', component: ImageGenerator },
        { id: 'imageEdit', name: 'Image Edit', icon: 'image_edit_auto', component: ImageEditor },
        { id: 'video', name: 'Video Gen', icon: 'video_spark', component: VideoGenerator },
        { id: 'animate', name: 'Animate Image', icon: 'movie', component: ImageAnimator },
        { id: 'speech', name: 'Speech Gen', icon: 'audio_spark', component: SpeechGenerator },
        { id: 'transcribe', name: 'Transcribe', icon: 'speech_to_text', component: AudioTranscriber },
    ];
    
    const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || Chatbot;

    return (
        <div className="flex h-screen bg-gray-900 text-gray-200 font-sans">
            <nav className="w-20 md:w-64 bg-gray-800/50 p-4 flex flex-col border-r border-gray-700">
                <div className="mb-8 flex items-center gap-3 px-2">
                    <Tooltip text="Gemini Creative Suite">
                      {Icons.spark}
                    </Tooltip>
                    <h1 className="text-xl font-bold hidden md:block">Creative Suite</h1>
                </div>
                <ul className="space-y-2">
                    {tabs.map(tab => (
                        <li key={tab.id}>
                            <Tooltip text={tab.name}>
                                <button
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center justify-center md:justify-start gap-4 p-3 rounded-lg text-left transition-colors ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}
                                >
                                    {Icons[tab.icon]}
                                    <span className="font-semibold hidden md:block">{tab.name}</span>
                                </button>
                            </Tooltip>
                        </li>
                    ))}
                </ul>
            </nav>
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="p-4 border-b border-gray-700 flex-shrink-0">
                    <h2 className="text-2xl font-bold">{tabs.find(t => t.id === activeTab)?.name}</h2>
                </header>
                <div className="flex-1 overflow-y-auto">
                    <ActiveComponent />
                </div>
            </main>
        </div>
    );
};

export default App;