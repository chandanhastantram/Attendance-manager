export async function parseTimetableWithGroq(base64Image, subjects, apiKey) {
  if (!apiKey) {
    throw new Error('Groq API Key is missing. Please add it in Settings.');
  }

  const subjectNames = subjects.map(s => s.name);
  const prompt = `You are a highly accurate OCR and timetable parser.
I am providing an image of a class timetable.
Extract the class schedule and return ONLY a raw JSON array of objects. No markdown formatting, no backticks, no explanations.

Here are the subjects I am enrolled in:
${subjectNames.join(', ')}

For every class you find in the image that roughly matches one of these subjects, extract it.

The JSON array must contain objects with exactly these keys:
- "subjectName": The exact subject name from my list that matches the class.
- "dayIndex": An integer from 0 to 6 representing the day of the week (0 = Monday, 1 = Tuesday, 2 = Wednesday, 3 = Thursday, 4 = Friday, 5 = Saturday, 6 = Sunday).
- "startTime": The start time in 24-hour HH:MM format (e.g., "09:00", "14:30").
- "endTime": The end time in 24-hour HH:MM format (e.g., "10:00", "15:30"). If no end time is specified, assume it is 1 hour after the start time.

Example valid output:
[
  { "subjectName": "${subjectNames[0] || 'Math'}", "dayIndex": 0, "startTime": "09:00", "endTime": "10:00" }
]

Return ONLY the JSON array.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.2-90b-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: base64Image } }
            ]
          }
        ],
        temperature: 0,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to analyze image with Groq.');
    }

    const data = await response.json();
    let textResult = data.choices[0].message.content.trim();
    
    // Clean up potential markdown formatting from LLM
    if (textResult.startsWith('\`\`\`')) {
      textResult = textResult.replace(/^\`\`\`(json)?\n/, '').replace(/\n\`\`\`$/, '');
    }

    const parsedJson = JSON.parse(textResult);
    if (!Array.isArray(parsedJson)) {
      throw new Error('Groq did not return an array.');
    }

    // Map back to full slot objects
    const results = [];
    const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (const item of parsedJson) {
      const matchedSubject = subjects.find(s => s.name.toLowerCase() === item.subjectName.toLowerCase());
      if (matchedSubject) {
        results.push({
          id: `groq-${Date.now()}-${Math.random()}`,
          subjectId: matchedSubject.id,
          subjectName: matchedSubject.name,
          subjectColor: matchedSubject.color,
          day: item.dayIndex,
          dayName: DAY_SHORT[item.dayIndex] || 'Unknown',
          startTime: item.startTime,
          endTime: item.endTime,
          room: '',
          confirmed: true,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Groq OCR Error:', error);
    throw new Error('Failed to parse timetable: ' + error.message);
  }
}
