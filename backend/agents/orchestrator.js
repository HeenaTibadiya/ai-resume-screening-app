// Import parser agent which extracts structured data from resume + job description
const { runParser } = require('./parserAgent');

// Function to safely extract JSON from a string response
function extractJSON(str) {
    if (!str) return null;

    // If already an object, return directly
    if (typeof str === 'object') return str;

    try {
        // Try to match a simple JSON object (no nested braces)
        const plain = str.match(/{[^{}]*}/);
        if (plain) return JSON.parse(plain[0]);

        // Fallback: match even nested JSON patterns
        const nested = str.match(/{[\s\S]*?}/);
        if (nested) return JSON.parse(nested[0]);
    } catch {
        // Ignore parsing errors and return null
    }

    return null;
}

// Function to calculate matching score between resume and required skills
function calculateScore(resumeSkills, requiredSkills) {
    // Return 0 if either list is empty
    if (!resumeSkills?.length || !requiredSkills?.length) return 0;

    // Normalize all skills to lowercase for comparison
    const resume = resumeSkills.map(s => s.toLowerCase());
    const required = requiredSkills.map(s => s.toLowerCase());

    // Find matched skills using partial matching (includes)
    const matched = required.filter(r =>
        resume.some(rs => rs.includes(r) || r.includes(rs))
    );

    // Return percentage score
    return Math.round((matched.length / required.length) * 100);
}

// Function to find matched skills
function findMatched(resumeSkills, requiredSkills) {
    if (!resumeSkills?.length || !requiredSkills?.length) return [];

    const resume = resumeSkills.map(s => s.toLowerCase());

    return requiredSkills.filter(r =>
        resume.some(rs =>
            rs.includes(r.toLowerCase()) || r.toLowerCase().includes(rs)
        )
    );
}

// Function to find missing skills
function findMissing(resumeSkills, requiredSkills) {
    if (!resumeSkills?.length || !requiredSkills?.length) return [];

    const resume = resumeSkills.map(s => s.toLowerCase());

    return requiredSkills.filter(r =>
        !resume.some(rs =>
            rs.includes(r.toLowerCase()) || r.toLowerCase().includes(rs)
        )
    );
}

// Main pipeline function that connects parser + scoring + feedback
async function runPipeline(resume, jobDescription) {
    console.log('Parser Agent...');

    // Call parser agent to extract structured info
    const parsedRaw = await runParser(resume, jobDescription);
    console.log('Parser raw:', parsedRaw);

    // Extract JSON safely from parser response
    const parsed = extractJSON(parsedRaw) || {};

    // Extract skills from parsed data
    const resumeSkills = parsed.resumeSkills || [];
    const requiredSkills = parsed.requiredSkills || parsed.jobSkills || [];

    console.log('Extracted parsed data:', parsed);
    console.log('Parsed resume skills:', resumeSkills);
    console.log('Parsed required skills:', requiredSkills);

    // Return final structured response
    return {
        parsed,
        matched: {
            score: 0,
            matchedSkills: [],
            missingSkills: [],
        }
    };
}

// Export pipeline function
module.exports = { runPipeline };