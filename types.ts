export enum MessageAuthor {
  USER = 'user',
  MODEL = 'model',
}

export interface Message {
  author: MessageAuthor;
  text: string;
}

export type AspectRatio = '16:9' | '9:16';
