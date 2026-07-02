from flask import Flask, request, jsonify
from flask_cors import CORS
import re

app = Flask(__name__)
CORS(app)

def analyze_text(text):
    text_lower = text.lower()
    
    # Simple Keyword-based Sentiment Simulation
    positive_words = ['good', 'great', 'excellent', 'amazing', 'love', 'best', 'awesome', 'happy']
    negative_words = ['bad', 'terrible', 'worst', 'awful', 'hate', 'poor', 'sad', 'angry', 'high']
    
    pos_count = sum(1 for word in positive_words if word in text_lower)
    neg_count = sum(1 for word in negative_words if word in text_lower)
    
    sentiment = 'Neutral'
    if pos_count > neg_count:
        sentiment = 'Positive'
    elif neg_count > pos_count:
        sentiment = 'Negative'

    # Simple Keyword-based Topic Classification
    topics = {
        'Delivery': ['delivery', 'shipping', 'late', 'fast', 'arrived', 'courier'],
        'Support': ['support', 'service', 'help', 'agent', 'representative', 'rude', 'polite'],
        'Price': ['price', 'cost', 'expensive', 'cheap', 'value', 'money', 'high', 'low'],
        'Product': ['product', 'quality', 'broken', 'feature', 'works', 'design']
    }
    
    detected_topic = 'Other'
    max_matches = 0
    
    for topic, keywords in topics.items():
        matches = sum(1 for word in keywords if word in text_lower)
        if matches > max_matches:
            max_matches = matches
            detected_topic = topic

    # Keyword Extraction (words > 4 chars, excluding common stop words)
    words = re.findall(r'\b[a-z]{5,}\b', text_lower)
    stop_words = {'about', 'there', 'their', 'which', 'would', 'could'}
    extracted = list(set([w for w in words if w not in stop_words]))[:5]

    return {
        'sentiment': sentiment,
        'topic': detected_topic,
        'keywords': extracted
    }

@app.route('/api/analyze', methods=['POST'])
def analyze():
    data = request.json
    if not data or 'text' not in data:
        return jsonify({'error': 'No text provided'}), 400
        
    text = data['text']
    result = analyze_text(text)
    
    return jsonify(result)

if __name__ == '__main__':
    app.run(port=5000, debug=True)
