/* 

                        this chatbot Code is without Restriction 
                            with Memories Context


*/

import { BufferMemory, ChatMessageHistory } from "langchain/memory";
import { HumanMessage, AIMessage } from "langchain/schema";
import { OpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import readline from "readline";
import dotenv from "dotenv";

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const history = new ChatMessageHistory(); // Initialize chat message history

class ChatBot {
  constructor() {
    this.memory = new BufferMemory({ chatHistory: history }); // Initialize with chat history
    this.model = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // Initialize OpenAI model with API key from environment variable
    this.chain = new ConversationChain({ llm: this.model, memory: this.memory });
  }

  async getUserInput(query) {
    return new Promise((resolve) => {
      rl.question(query, (answer) => {
        resolve(answer);
      });
    });
  }

  async startChat() {
    try {
      console.log("\x1b[44mChatGpt: Hello! I am your ChatGpt!\x1b[0m");

      let userInput = "";
      while (userInput.trim().toLowerCase() !== "exit") {
        userInput = await this.getUserInput("\nEnter your message -> ");

        if (userInput.trim().toLowerCase() === "exit") {
          break;
        }

        // Check if user input is "history" to display chat history
        if (userInput.trim().toLowerCase() === "history") {
          const messages = await history.getMessages();
          console.log("\nChat History:");
          console.log(messages)
          continue;
        }

        // Add user input as a HumanMessage to the memory and chat history
        const humanMessage = new HumanMessage(userInput);
        this.memory.chatHistory.addMessage(humanMessage);

        const response = await this.chain.call({ input: userInput });
        console.log(response);

        // Check if response has text before adding as AIMessage
        if (response && response.response) {
          const aiResponse = response.response;
          const aiMessage = new AIMessage(aiResponse);
          this.memory.chatHistory.addMessage(aiMessage);
        }
      }

      console.log("ChatBot: Goodbye!");
    } catch (error) {
      console.error("ChatBot Error:", error);
    } finally {
      rl.close();
    }
  }
}

async function main() {
  const chatBot = new ChatBot();
  await chatBot.startChat();
}

main();



