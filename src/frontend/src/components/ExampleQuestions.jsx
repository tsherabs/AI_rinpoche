const EXAMPLE_QUESTIONS = [
  'What does Rinpoche say about Vajrayana in the West?',
  'How can meditation help in daily life?',
  'What role does compassion play on the path?',
  'What advice does Rinpoche give to new practitioners?',
];

export default function ExampleQuestions({ onExampleClick, disabled }) {
  return (
    <div className="example-questions">
      <h2 className="welcome-title">Ask about Shechen Rabjam Rinpoche’s teachings</h2>
      <p className="welcome-text">
        Answers come only from the teachings in this collection, with the sources shown below each answer.
      </p>
      <div className="example-chips">
        {EXAMPLE_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            className="example-chip"
            onClick={() => onExampleClick(question)}
            disabled={disabled}
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
