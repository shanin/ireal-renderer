from flask import Flask, request, jsonify, send_from_directory
import os
import subprocess
import random
import string

app = Flask(__name__, static_folder='.')

# Create downloads directory if it doesn't exist
os.makedirs('downloads', exist_ok=True)

@app.route('/')
def home():
    return send_from_directory('.', 'index.html')

# Serve the playlist file specifically
@app.route('/playlist.html')
def playlist():
    return send_from_directory('.', 'playlist.html')

# Serve all static files
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/downloads/<path:filename>')
def download_file(filename):
    return send_from_directory('downloads', filename)

@app.route('/download', methods=['POST'])
def download_youtube():
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'})
        
        youtube_url = data.get('url', '')
        
        if not youtube_url:
            return jsonify({'success': False, 'error': 'No URL provided'})
        
        # Generate a random filename
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        output_filename = f"youtube_{random_suffix}.mp3"
        output_path = os.path.join('downloads', output_filename)
        
        # Use yt-dlp to download the video and convert to mp3
        command = [
            'yt-dlp',
            '-x',  # Extract audio
            '--audio-format', 'mp3',
            '--audio-quality', '0',  # Best quality
            '-o', output_path,
            youtube_url
        ]
        
        # Run the command
        process = subprocess.run(command, capture_output=True, text=True)
        
        if process.returncode != 0:
            return jsonify({'success': False, 'error': process.stderr})
        
        # Make sure the file exists
        if not os.path.exists(output_path):
            return jsonify({'success': False, 'error': 'File was not created'})
        
        return jsonify({'success': True, 'filename': output_filename})
    
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print("Exception occurred:", error_traceback)
        return jsonify({'success': False, 'error': str(e), 'traceback': error_traceback})

if __name__ == '__main__':
    app.run(debug=True, threaded=True, port=5656)