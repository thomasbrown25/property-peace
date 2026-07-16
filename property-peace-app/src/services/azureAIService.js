import { AzureOpenAI } from 'openai';

// Initialize Azure OpenAI client
let client = null;

const getClient = () => {
  if (!client) {
    const endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
    const apiKey = import.meta.env.VITE_AZURE_OPENAI_API_KEY;
    const deploymentName = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4.1-mini';
    const apiVersion = import.meta.env.VITE_AZURE_OPENAI_API_VERSION || '2024-04-01-preview';

    if (!endpoint || !apiKey) {
      throw new Error('Azure OpenAI configuration is missing. Please set VITE_AZURE_OPENAI_ENDPOINT and VITE_AZURE_OPENAI_API_KEY');
    }

    // Remove trailing slash if present
    const baseURL = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;

    client = new AzureOpenAI({
      apiKey: apiKey,
      endpoint: baseURL,
      deployment: deploymentName,
      apiVersion: apiVersion,
      dangerouslyAllowBrowser: true // Required for browser usage - API key will be exposed in client bundle
    });
  }
  return client;
};

/**
 * Generate a chat completion using Azure OpenAI
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} options - Additional options (temperature, maxTokens, etc.)
 * @returns {Promise<string>} - The generated response text
 */
export const generateChatCompletion = async (messages, options = {}) => {
  try {
    const client = getClient();

    const {
      temperature = 0.7,
      maxTokens = 1000,
      functions = null,
      functionCall = null
    } = options;

    const requestOptions = {
      messages: messages,
      temperature,
      max_tokens: maxTokens,
      ...(functions && { functions }),
      ...(functionCall && { function_call: functionCall })
    };

    // Don't pass model - it's already set in the AzureOpenAI client via deployment
    const response = await client.chat.completions.create(requestOptions);

    if (!response.choices || response.choices.length === 0) {
      throw new Error('No response from Azure OpenAI');
    }

    const choice = response.choices[0];
    
    // Check if function call was requested
    if (choice.message?.function_call) {
      return {
        functionCall: choice.message.function_call,
        content: choice.message.content || ''
      };
    }

    return choice.message?.content || '';
  } catch (error) {
    console.error('Azure OpenAI API error:', error);
    throw new Error(`Failed to generate chat completion: ${error.message}`);
  }
};

/**
 * Stream chat completions for real-time updates
 * @param {Array} messages - Array of message objects
 * @param {Function} onChunk - Callback function for each chunk
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - The complete response text
 */
export const streamChatCompletion = async (messages, onChunk, options = {}) => {
  try {
    const client = getClient();

    const {
      temperature = 0.7,
      maxTokens = 1000
    } = options;

    // Don't pass model - it's already set in the AzureOpenAI client via deployment
    const stream = await client.chat.completions.create({
      messages: messages,
      temperature,
      max_tokens: maxTokens,
      stream: true
    });

    let fullResponse = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
        if (onChunk) {
          onChunk(delta, fullResponse);
        }
      }
    }

    return fullResponse;
  } catch (error) {
    console.error('Azure OpenAI streaming error:', error);
    throw new Error(`Failed to stream chat completion: ${error.message}`);
  }
};

/**
 * Check if Azure OpenAI is configured
 * @returns {boolean}
 */
export const isConfigured = () => {
  const endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
  const apiKey = import.meta.env.VITE_AZURE_OPENAI_API_KEY;
  return !!(endpoint && apiKey);
};

