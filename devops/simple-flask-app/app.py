from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///example.db'
db = SQLAlchemy(app)

# Simple SQLite table
class Item(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)

# Create database and table
with app.app_context():
    db.create_all()

# Routes
@app.route('/')
def index():
    return "Hello, Flask!"

@app.route('/items', methods=['GET', 'POST'])
def items():
    if request.method == 'POST':
        data = request.json
        item = Item(name=data['name'])
        db.session.add(item)
        db.session.commit()
        return jsonify({"message": "Item added"}), 201

    items = Item.query.all()
    return jsonify([{"id": item.id, "name": item.name} for item in items])

@app.route('/healthz')
def healthz():
    return jsonify({"status": "ok"}), 200

@app.route('/ready')
def ready():
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "ready"}), 200
    except Exception as e:
        print(f"Readiness check failed: {e}")
        return jsonify({"status": "not ready", "error": str(e)}), 503

# Run the app
if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0")
