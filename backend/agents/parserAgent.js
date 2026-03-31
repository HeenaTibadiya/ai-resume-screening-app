const { Ollama } = require('@langchain/community/llms/ollama');
const { PromptTemplate } = require('@langchain/core/prompts');
const { LLMChain } = require('langchain/chains');

const llm = new Ollama({ model: 'qwen2.5:0.5b', temperature: 0, numPredict: 200 });

const prompt = new PromptTemplate({
  inputVariables: ['resume', 'jobDescription'],
  template: `Extract skills only. Reply with ONLY this JSON, no extra text:
{{"resumeSkills": ["skill1", "skill2"], "jobSkills": ["skill1", "skill2"]}}

Resume: {resume}
Job: {jobDescription}`
});

const parserChain = new LLMChain({ llm, prompt });

async function runParser(resume, jobDescription) {
  const result = await parserChain.call({ resume, jobDescription });
  return result.text;
}

module.exports = { runParser };