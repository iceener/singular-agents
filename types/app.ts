
export interface OpenAIRequestBody {
    messages: {
      role: 'user' | 'developer' | 'assistant' | string;
      content: string;
    }[];
  }
  
export interface OpenAIResponseBody {
    choices: {
      index: number;
      message: {
        role: 'assistant';
        content: string;
        refusal: null | any;
        annotations: any[];
      };
    }[];
  }