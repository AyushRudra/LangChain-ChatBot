import { MongoClient } from "mongodb";
import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";
import { LLMChain } from "langchain/chains";
import * as dotenv from "dotenv";
import readline from "readline";

import { BufferMemory } from "langchain/memory";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

class ChatBot {
  constructor() {
    this.context = {};
    this.currentTopic = null;
    this.memory = new BufferMemory(); // Initialize memory
    this.mongoClient = new MongoClient(process.env.MONGODB_URI);
    this.aiMessageHistory = new ChatMessageHistory(); // AI Message history
    this.mongoDBMessageHistory = new ChatMessageHistory(); // MongoDB Message history
  }

  async connectToMongo() {
    try {
      await this.mongoClient.connect();
      console.log("Connected to MongoDB");
    } catch (error) {
      console.error("Error connecting to MongoDB:", error);
      process.exit(1);
    }
  }

  async getUserInput(query) {
    return new Promise((resolve) => {
      rl.question(query, (answer) => {
        resolve(answer);
      });
    });
  }

  addBackgroundColor(text, colorCode) {
    return `\x1b[48;5;${colorCode}m${text}\x1b[0m`;
  }

  async selectTopic() {
    while (!this.currentTopic) {
      const topicInput = await this.getUserInput(
        "\nEnter the topic you want to discuss: "
      );

      if (topicInput.toLowerCase() === "exit") {
        break;
      }
      this.currentTopic = topicInput.toLowerCase();
      console.log(`ChatBot: You've selected the topic: ${this.currentTopic}`);
    }
  }

  displayTopicMismatchMessage() {
    console.log(
      "ChatBot: Your input doesn't seem to be directly related to the current topic."
    );
  }

  isRelatedToTopic(userInput) {
    const topicKeywords = this.currentTopic.split(" ");
    return topicKeywords.some((keyword) =>
      userInput.toLowerCase().includes(keyword)
    );
  } 

  async handleRudraInnovativeQuery() {
    let userInput = '';

    while (userInput.toLowerCase() !== 'exit') {
        userInput = await this.getUserInput("\n About Rudra Innovative Mohali -> ");
        if (userInput.toLowerCase() !== 'exit') {
            await this.interactWithOpenAI(userInput);
        }
    }
    console.log("\x1b[44mThank you for learning about Rudra Innovative\x1b[0m");
}

async handleUserInput(userInput) {

  try {
    
    if (userInput.toLowerCase() === "exit") {
      this.currentTopic = null;
      console.log("ChatBot: Topic cleared. You can select a new topic.");
      await this.selectTopic(); // Prompt the user to select a new topic
      return;
    }

    if (userInput.toLowerCase() === "chathistory") {
      console.log(
        "\nAI Message History:",
        await this.aiMessageHistory.getMessages()
      );
      console.log(
        "\nMongoDb Message History:",
        await this.mongoDBMessageHistory.getMessages()
      );
      return;
    }

    if (userInput.toLowerCase().includes("rudra innovative")) {
      await this.handleRudraInnovativeQuery();
      return;
    }

    if (!this.currentTopic) {
      await this.selectTopic();
      return;
    }

    if (!this.isRelatedToTopic(userInput)) {
      this.displayTopicMismatchMessage();
      return;
    }

    // Identify the keywords in the user input
    const inputKeywords = userInput.toLowerCase().split(" ");

    // Check if any of the input keywords match the current topic keywords
    const matchingKeywords = inputKeywords.filter((keyword) =>
      this.currentTopic.includes(keyword)
    );

    if (matchingKeywords.length > 0) {
      // User is discussing the current topic
      console.log(`ChatBot: Discussing the topic "${this.currentTopic}"`);
    } else {
      // User is introducing a new sub-topic or something unrelated
      console.log(
        `ChatBot: Your input doesn't seem to be directly related to the current topic.`
      );
      return;
    }

    // Update context and memory with the relevant information
    const contextUpdate = {
      topic: this.currentTopic,
      userInput: userInput
    };
    this.updateContextAndMemory(contextUpdate);

    const existingData = await this.queryMongoDB(userInput);

    if (existingData) {
      this.displayMongoDBResponse(existingData.response);
    } else {
      await this.interactWithOpenAI(userInput);
    }
  } catch (error) {
    this.handleErrorDuringOpenAI(error);
  }
}


  handleOpenAIResult(userInput, result) {

    if (result && result.text !== undefined) {
      const coloredResponse = this.addBackgroundColor(result.text, 1);
      console.log(`\nAI Response: ${coloredResponse}`);

      this.storeResultInMongoDB(userInput, result.text);
      this.aiMessageHistory.addMessage(new AIMessage(result.text)); // Store AI message in history
    } else {
      console.error("Error: Invalid response from OpenAI model.");
    }
    this.updateContextAndMemory(result);
  }

  async storeResultInMongoDB(userInput, response) {
    const db = this.mongoClient.db(process.env.MONGODB_DATABASE);
    const collection = db.collection("searchData");
    await collection.insertOne({ query: userInput, response });
    this.mongoDBMessageHistory.addMessage(new HumanMessage(response)); // Store MongoDB response in history
  }

  async queryMongoDB(userInput) {
    const db = this.mongoClient.db(process.env.MONGODB_DATABASE);
    const collection = db.collection("searchData");

    // regular expression for a more flexible query match
    const regexQuery = { query: { $regex: new RegExp(userInput, "i") } };
    return await collection.findOne(regexQuery);
  }

  displayMongoDBResponse(response) {
    const coloredResponse = this.addBackgroundColor(response, 26);
    console.log(`\nMongoDB Response: ${coloredResponse}`);
  }

  async interactWithOpenAI(userInput) {
    const template = userInput;
    const promptTemplate = new PromptTemplate({
      template,
      inputVariables: [],
    });

    const openAIModel = new OpenAI({
      temperature: 0.5,
    });

    const llmChain = new LLMChain({
      llm: openAIModel,
      prompt: promptTemplate,
    });

    const result = await llmChain.call({
      context: this.context,
      memory: this.memory,
    });
    this.handleOpenAIResult(userInput, result);
  }

  updateContextAndMemory(result) {
    this.context = result && result.context ? result.context : this.context;
    this.memory = result && result.memory ? result.memory : this.memory;
  }

  handleErrorDuringOpenAI(error) {
    console.error("Error during OpenAI model call:", error);
  }

  async startChat() {

    try {

      await this.connectToMongo();
      console.log("\x1b[44mChatGpt: Hello! I am your ChatGpt!\x1b[0m");
      await this.selectTopic();

      while (this.currentTopic) {
        const userInput = await this.getUserInput(
          `\nEnter your question or statement on the topic "${this.currentTopic}" -> `
        );
        if (userInput.trim().toLowerCase() === "exit") {
          break;
        }
        await this.handleUserInput(userInput);
      }
      console.log("ChatBot: Goodbye!");
    } catch (error) {
      console.error("ChatBot Error:", error);
    } finally {
      await this.mongoClient.close(); // Close MongoDB connection
      rl.close();
    }
  }
}

async function main() {

  const chatBot = new ChatBot();
  await chatBot.startChat();
}
main();
