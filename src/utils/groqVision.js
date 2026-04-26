export async function parseWithGroq(base64Image, subjects, apiKey, scanType = 'timetable') {
  if (!apiKey) {
    throw new Error('Groq API Key is missing. Please add it in Settings.');
  }

  const subjectNames = subjects.map(s => s.name);
  
  let prompt = '';
  if (scanType === 'timetable') {
    prompt = `You are a highly accurate OCR and timetable parser.
I am providing an image of a class timetable.
Extract the class schedule and return ONLY a raw JSON array of objects. No markdown formatting.

Here are the subjects I am enrolled in:
${subjectNames.join(', ')}

The JSON array must contain objects with exactly these keys:
- "subjectName": The exact subject name from my list that matches the class.
- "dayIndex": An integer from 0 to 6 representing the day of the week (0 = Monday).
- "startTime": The start time in 24-hour HH:MM format (e.g., "09:00").
- "endTime": The end time in 24-hour HH:MM format.

Example:
[
  { "subjectName": "${subjectNames[0] || 'Math'}", "dayIndex": 0, "startTime": "09:00", "endTime": "10:00" }
]`;
  } else if (scanType === 'attendance') {
    prompt = `You are an OCR attendance parser.
Extract the attendance records from the image and return ONLY a raw JSON array of objects. No markdown formatting.

The JSON array must contain objects with exactly these keys:
- "subjectName": The exact name of the subject.
- "held": Total number of classes held (integer).
- "attended": Total number of classes attended (integer).
- "pct": Attendance percentage (integer 0-100).

Example:
[
  { "subjectName": "Math", "held": 20, "attended": 18, "pct": 90 }
]`;
  } else if (scanType === 'subjects') {
    prompt = `You are an OCR parser.
Extract the list of subjects/courses from the image and return ONLY a raw JSON array of objects. No markdown formatting.

The JSON array must contain objects with exactly these keys:
- "subjectName": The extracted name of the subject/course.

Example:
[
  { "subjectName": "Advanced Mathematics" }
]`;
  }

  prompt += '\n\nReturn ONLY the JSON array.';

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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

    const results = [];
    const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (const item of parsedJson) {
      if (scanType === 'timetable') {
        const matchedSubject = subjects.find(s => s.name.toLowerCase() === item.subjectName.toLowerCase());
        results.push({
          id: `groq-${Date.now()}-${Math.random()}`,
          subjectId: matchedSubject?.id || null,
          subjectName: matchedSubject?.name || item.subjectName,
          subjectColor: matchedSubject?.color || '#cccccc',
          day: item.dayIndex,
          dayName: DAY_SHORT[item.dayIndex] || 'Unknown',
          startTime: item.startTime,
          endTime: item.endTime,
          room: '',
          confirmed: true,
          isKnown: !!matchedSubject
        });
      } else if (scanType === 'attendance') {
        results.push({
          subjectName: item.subjectName,
          held: item.held,
          attended: item.attended,
          missed: item.held - item.attended,
          pct: item.pct,
          isKnown: subjects.some(s => s.name.toLowerCase() === item.subjectName.toLowerCase())
        });
      } else if (scanType === 'subjects') {
        results.push({
          subjectName: item.subjectName,
          isKnown: subjects.some(s => s.name.toLowerCase() === item.subjectName.toLowerCase())
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Groq OCR Error:', error);
    throw new Error('Failed to parse timetable: ' + error.message);
  }
}
