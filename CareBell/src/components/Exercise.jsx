import React, { useState, useEffect } from "react";
import { API } from "../config";
import { useTranslation } from "react-i18next";

function Exercise() {
  const { t } = useTranslation();
  const [exercises, setExercises] = useState([]);
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [currentSpeakingId, setCurrentSpeakingId] = useState(null);

  // Fetch exercises when component mounts
  useEffect(() => {
    fetchExercises();
    
    // Clean up speech on unmount
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Filter exercises when filters change
  useEffect(() => {
    filterExercises();
  }, [exercises, selectedCategory, selectedDifficulty]);

  // Fetch exercises from API
  const fetchExercises = async () => {
    try {
      setLoading(true);
      
      // Try HTTPS first, fallback to HTTP
      let res;
      try {
        res = await fetch(`${API}/exercises/elderly-friendly`);
      } catch (err) {
        console.log("HTTPS failed, trying HTTP");
        res = await fetch('http://carebell.online/exercises/elderly-friendly');
      }
      
      if (!res.ok) {
        throw new Error(`Failed to fetch exercises: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log("Fetched exercises:", data);
      
      setExercises(data);
      setFilteredExercises(data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching exercises:", err);
      setError(`Could not load exercises: ${err.message}. Please check your server connection.`);
      setLoading(false);
    }
  };

  // Filter exercises based on selected criteria
  const filterExercises = () => {
    let filtered = exercises;
    
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(exercise => exercise.category === selectedCategory);
    }
    
    if (selectedDifficulty !== 'All') {
      filtered = filtered.filter(exercise => exercise.difficulty === selectedDifficulty);
    }
    
    setFilteredExercises(filtered);
  };

  // Text-to-speech function with native voice selection
  const speakText = (text, exerciseId) => {
    // Stop any ongoing speech
    stopSpeaking();
    
    if (!text) return;
    
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set properties for elderly-friendly speech
      utterance.rate = 0.8;  // Slower speed for elderly
      utterance.pitch = 1;   // Normal pitch
      utterance.volume = 1;  // Full volume
      
      // Try to get a native American English voice
      const voices = window.speechSynthesis.getVoices();
      const bestVoice = voices.find(voice => 
        voice.lang === 'en-US' && 
        (voice.name.includes('Samantha') || 
         voice.name.includes('Alex') ||     
         voice.name.includes('Daniel') ||  
         voice.name.includes('David'))
      ) || voices.find(voice => voice.lang === 'en-US');
      
      if (bestVoice) {
        utterance.voice = bestVoice;
      }
      
      // Start and end events
      utterance.onstart = () => {
        setSpeaking(true);
        setCurrentSpeakingId(exerciseId);
      };
      utterance.onend = () => {
        setSpeaking(false);
        setCurrentSpeakingId(null);
      };
      
      // Speak the text
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Speech synthesis error:", err);
    }
  };

  // Stop speaking function
  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      setCurrentSpeakingId(null);
    }
  };

  // Create exercise description for speech
  const createExerciseDescription = (exercise) => {
    if (!exercise) return "";
    
    let description = `This is ${exercise.name}. `;
    description += `${exercise.description}. `;
    description += `This is a ${exercise.difficulty} exercise targeting ${exercise.targetAreas.join(", ")}. `;
    description += `It takes about ${exercise.duration} minutes. `;
    
    if (exercise.benefits && exercise.benefits.length > 0) {
      description += `Benefits include: ${exercise.benefits.join(", ")}. `;
    }
    
    return description;
  };

  // Get unique categories from exercises
  const categories = ['All', ...new Set(exercises.map(ex => ex.category))];
  const difficulties = ['All', 'Easy', 'Medium', 'Hard'];

  // Sample exercises with GIF URLs
  const sampleExercisesData = [
    {
      guid: "elderly-exercise-001",
      name: "Wall Pushups",
      description: "Gentle pushups against a wall to strengthen chest and shoulders.",
      instructions: "1. Stand about 3 feet away from a wall, facing it with your feet shoulder-width apart\n2. Lean forward and place your hands flat on the wall, in line with your shoulders\n3. Your body should be in plank position, with your spine straight, not sagging or arched\n4. Lower your body toward the wall and then push back\n5. Repeat 10 times",
      difficulty: "Easy",
      targetAreas: ["Chest", "Shoulders", "Arms"],
      duration: 5,
      caloriesBurned: 20,
      reps: 10,
      sets: 1,
      equipment: ["Wall"],
      gifUrl: "https://i.pinimg.com/originals/46/bf/57/46bf5743497f7f39eb42b3ade9ee5236.gif",
      videoUrl: null,
      benefits: ["Strengthens upper body", "Improves posture", "Low impact on joints"],
      precautions: ["Use a stable wall", "Keep movements controlled", "Don't force movement"],
      modifications: ["Move closer to wall for easier version", "Start with fewer reps"],
      category: "Strength",
      elderlyFriendly: true
    },
    {
      guid: "elderly-exercise-002",
      name: "Seated Leg Extensions",
      description: "Gentle leg strengthening exercise done while sitting.",
      instructions: "1. Sit in a chair with back support\n2. Slowly extend one leg straight out\n3. Hold for 2-3 seconds\n4. Lower slowly\n5. Repeat with other leg",
      difficulty: "Easy",
      targetAreas: ["Quadriceps", "Knees"],
      duration: 4,
      caloriesBurned: 15,
      reps: 6,
      sets: 1,
      equipment: ["Chair"],
      gifUrl: "https://example.com/seated-leg-extensions.gif", // Replace with actual GIF
      videoUrl: null,
      benefits: ["Strengthens quadriceps", "Improves flexibility", "Low impact"],
      precautions: ["Don't lock knee completely", "Slow controlled movements"],
      modifications: ["Reduce range of motion", "Add ankle weights for challenge"],
      category: "Strength",
      elderlyFriendly: true
    },
    {
      guid: "elderly-exercise-003",
      name: "Neck Rolls",
      description: "Gentle neck movement to relieve stiffness.",
      instructions: "1. Sit or stand comfortably\n2. Slowly turn head to look right\n3. Then forward, left, back\n4. Repeat in opposite direction\n5. Do 4 complete rotations",
      difficulty: "Easy",
      targetAreas: ["Neck", "Shoulders"],
      duration: 2,
      caloriesBurned: 5,
      reps: 4,
      sets: 1,
      equipment: ["None"],
      gifUrl: "https://example.com/neck-rolls.gif", // Replace with actual GIF
      videoUrl: null,
      benefits: ["Reduces stiffness", "Improves neck mobility", "Relieves tension"],
      precautions: ["Move slowly", "Stop if dizzy", "Don't force movements"],
      modifications: ["Limit range of motion", "Do seated only"],
      category: "Flexibility",
      elderlyFriendly: true
    }
  ];

  // Handle populate database
  const populateDatabase = async () => {
    try {
      setLoading(true);
      
      const res = await fetch(`${API}/exercises/populate-sample`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ exercises: sampleExercisesData })
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`Success! Added ${data.exercises.length} exercises to the database.`);
        fetchExercises(); // Refresh the list
      } else {
        throw new Error('Failed to populate exercises');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Error adding exercises. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

 return (
  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl overflow-hidden min-h-screen">
    <div className="bg-white shadow-lg p-8 border-b-4 border-blue-200">
      <h1 className="text-5xl font-bold text-center text-blue-900 flex items-center justify-center">
        <span className="mr-4 text-6xl">💪</span>
        {t("Exercise.Library")}
      </h1>
    </div>

    <div className="p-8">
      {/* Enhanced Add exercises button if database is empty */}
      {exercises.length === 0 && !loading && (
        <div className="mb-8 bg-gradient-to-r from-yellow-100 to-orange-100 border-4 border-yellow-300 rounded-3xl p-8 shadow-xl">
          <div className="text-center">
            <div className="text-6xl mb-4">🏋️‍♀️</div>
            <h2 className="text-3xl font-bold mb-4 text-yellow-800">{t("Exercise.no_exercises_label")}</h2>
            <p className="text-xl text-yellow-700 mb-6 leading-relaxed">
              {t("Exercise.no_exercises")}
            </p>
            <button
              onClick={populateDatabase}
              className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white text-2xl font-bold rounded-2xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
            >
              <span className="mr-3 text-3xl">➕</span>
              {t("Exercise.add_exercises")}
            </button>
          </div>
        </div>
      )}
      
      {/* Enhanced Filters */}
      <div className="mb-8 bg-white rounded-3xl p-8 shadow-xl border-2 border-blue-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-2xl font-bold mb-4 text-gray-800 flex items-center">
              <span className="mr-3 text-3xl">📂</span>
              {t("Exercise.Category")}
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-4 text-xl border-3 border-blue-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-200 rounded-2xl shadow-lg transition-all duration-200 font-semibold"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-2xl font-bold mb-4 text-gray-800 flex items-center">
              <span className="mr-3 text-3xl">⚡</span>
              {t("Exercise.difficulty")}
            </label>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full p-4 text-xl border-3 border-blue-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-200 rounded-2xl shadow-lg transition-all duration-200 font-semibold"
            >
              {difficulties.map(difficulty => (
                <option key={difficulty} value={difficulty}>{difficulty}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="flex flex-col justify-center items-center py-16 bg-white rounded-3xl shadow-xl border-2 border-blue-200">
          <div className="animate-spin rounded-full h-20 w-20 border-6 border-blue-500 border-t-transparent mb-6"></div>
          <p className="text-2xl text-gray-600 font-bold">Loading exercises...</p>
        </div>
      ) : error ? (
        <div className="bg-gradient-to-r from-red-100 to-red-200 border-4 border-red-400 text-red-800 p-8 rounded-3xl shadow-xl">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="font-bold text-3xl mb-4">{t("Exercise.Error")}</h3>
            <p className="text-xl mb-6">{error}</p>
            <button 
              onClick={fetchExercises}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xl font-bold rounded-2xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
            >
              <span className="mr-3 text-2xl">🔄</span>
              {t("Exercise.Try_Again")}
            </button>
          </div>
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl shadow-xl border-2 border-blue-200">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-2xl text-gray-600 mb-6 font-bold">
            {t("Exercise.no_exercises_criteria")}
          </p>
          {selectedDifficulty === 'Hard' && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-8 mt-6 max-w-2xl mx-auto">
              <div className="text-4xl mb-4">💡</div>
              <p className="text-xl text-blue-800 mb-4 font-semibold">
                {t("Exercise.Hard_label")}
              </p>
              <button
                onClick={() => setSelectedDifficulty('Medium')}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                <span className="mr-2">📊</span>
                {t("Exercise.showMedium")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Enhanced Exercise List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {filteredExercises.map((exercise) => (
              <div 
                key={exercise._id} 
                className={`bg-white border-3 border-blue-200 hover:border-blue-400 rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-300 ${
                  currentSpeakingId === exercise._id ? "ring-4 ring-yellow-400 border-yellow-400" : ""
                }`}
              >
                <div className="relative">
                  <img 
                    src={exercise.gifUrl || "https://via.placeholder.com/400x300?text=Exercise+GIF"} 
                    alt={exercise.name} 
                    className="w-full h-64 object-cover"
                    onError={(e) => {
                      e.target.src = "https://via.placeholder.com/400x300?text=Exercise+GIF";
                    }}
                  />
                  
                  <div className="absolute top-4 right-4">
                    <span className={`px-4 py-2 rounded-2xl text-lg font-bold shadow-lg ${
                      exercise.difficulty === 'Easy' ? 'bg-green-500 text-white' :
                      exercise.difficulty === 'Medium' ? 'bg-yellow-500 text-black' :
                      'bg-red-500 text-white'
                    }`}>
                      {exercise.difficulty}
                    </span>
                  </div>
                  
                  <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 rounded-2xl px-4 py-2">
                    <span className="text-lg font-bold text-blue-900">
                      ⏱️ {exercise.duration} min
                    </span>
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 className="text-3xl font-bold text-gray-900 mb-3 flex items-center">
                    <span className="mr-3 text-4xl">🏋️</span>
                    {exercise.name}
                  </h3>
                  
                  <div className="mb-4 flex items-center flex-wrap gap-2 text-lg text-blue-700">
                    <span className="font-bold">📂 {exercise.category}</span>
                    <span className="text-gray-400">•</span>
                    <span className="font-bold">⏱️ {exercise.duration} min</span>
                  </div>
                  
                  <p className="text-lg text-gray-700 mb-6 leading-relaxed line-clamp-3">{exercise.description}</p>
                  
                  <div className="mb-6">
                    <span className="text-lg text-gray-600 font-bold flex items-center mb-3">
                      <span className="mr-2 text-2xl">🎯</span>
                      {t("Exercise.target_areas")}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {exercise.targetAreas.map((area, idx) => (
                        <span key={idx} className="text-sm bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 px-3 py-2 rounded-2xl font-bold border border-blue-300">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    <button
                      onClick={() => setSelectedExercise(exercise)}
                      className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                    >
                      <span className="mr-3 text-2xl">👁️</span>
                      {t("Exercise.view_details")}
                    </button>
                    
                    {currentSpeakingId === exercise._id && speaking ? (
                      <button
                        onClick={stopSpeaking}
                        className="w-full px-6 py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-white text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                      >
                        <span className="mr-3 text-2xl">🔇</span>
                        {t("Exercise.stop")}
                      </button>
                    ) : (
                      <button
                        onClick={() => speakText(createExerciseDescription(exercise), exercise._id)}
                       className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                     >
                       <span className="mr-3 text-2xl">🔊</span>
                       {t("Exercise.read")}
                     </button>
                   )}
                 </div>
               </div>
             </div>
           ))}
         </div>
       </div>
     )}
     
     {/* Enhanced Exercise Detail Modal */}
     {selectedExercise && (
       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
         <div className="bg-white rounded-3xl shadow-2xl border-4 border-blue-200 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
           <div className="p-8">
             <div className="flex justify-between items-center mb-8">
               <h2 className="text-4xl font-bold text-blue-900 flex items-center">
                 <span className="mr-4 text-5xl">🏋️</span>
                 {selectedExercise.name}
               </h2>
               <button
                 onClick={() => setSelectedExercise(null)}
                 className="text-3xl font-bold text-red-600 hover:text-red-800 w-12 h-12 flex items-center justify-center rounded-full hover:bg-red-100 transition-all duration-200"
               >
                 ✕
               </button>
             </div>
             
             {/* Enhanced GIF Display */}
             {selectedExercise.gifUrl && (
               <div className="mb-8">
                 <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-blue-200">
                   <img 
                     src={selectedExercise.gifUrl} 
                     alt={`${selectedExercise.name} Exercise Animation`} 
                     className="w-full rounded-3xl"
                     onError={(e) => {
                       console.error('GIF failed to load:', selectedExercise.gifUrl);
                       e.target.parentNode.innerHTML = `
                         <div class="bg-gray-100 p-12 rounded-3xl text-center border-4 border-gray-300">
                           <div class="text-6xl mb-4">🏋️‍♀️</div>
                           <p class="text-2xl text-gray-600 font-bold">Exercise animation not available</p>
                           <p class="text-lg text-gray-500 mt-2">The exercise GIF could not be loaded.</p>
                         </div>
                       `;
                     }}
                   />
                 </div>
               </div>
             )}
             
             <div className="space-y-8">
               <div className="bg-blue-50 rounded-3xl p-6 border-2 border-blue-200">
                 <h3 className="text-2xl font-bold mb-4 text-blue-900 flex items-center">
                   <span className="mr-3 text-3xl">📝</span>
                   {t("Exercise.descriptionLabel")}
                 </h3>
                 <p className="text-xl text-gray-800 leading-relaxed">{selectedExercise.description}</p>
               </div>
               
               <div className="bg-green-50 rounded-3xl p-6 border-2 border-green-200">
                 <h3 className="text-2xl font-bold mb-4 text-green-900 flex items-center">
                   <span className="mr-3 text-3xl">📋</span>
                   {t("Exercise.instructionsLabel")}
                 </h3>
                 <div className="text-xl text-gray-800 leading-relaxed whitespace-pre-line">{selectedExercise.instructions}</div>
               </div>
               
               {selectedExercise.benefits && selectedExercise.benefits.length > 0 && (
                 <div className="bg-yellow-50 rounded-3xl p-6 border-2 border-yellow-200">
                   <h3 className="text-2xl font-bold mb-4 text-yellow-900 flex items-center">
                     <span className="mr-3 text-3xl">✨</span>
                     {t("Exercise.benefitsLabel")}
                   </h3>
                   <ul className="space-y-3">
                     {selectedExercise.benefits.map((benefit, idx) => (
                       <li key={idx} className="flex items-center text-xl text-gray-800">
                         <span className="mr-3 text-2xl">💪</span>
                         {benefit}
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
               
               {selectedExercise.precautions && selectedExercise.precautions.length > 0 && (
                 <div className="bg-red-50 rounded-3xl p-6 border-2 border-red-200">
                   <h3 className="text-2xl font-bold mb-4 text-red-900 flex items-center">
                     <span className="mr-3 text-3xl">⚠️</span>
                     {t("Exercise.precautionsLabel")}
                   </h3>
                   <ul className="space-y-3">
                     {selectedExercise.precautions.map((precaution, idx) => (
                       <li key={idx} className="flex items-center text-xl text-red-800">
                         <span className="mr-3 text-2xl">🚨</span>
                         {precaution}
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
               
               {selectedExercise.modifications && selectedExercise.modifications.length > 0 && (
                 <div className="bg-purple-50 rounded-3xl p-6 border-2 border-purple-200">
                   <h3 className="text-2xl font-bold mb-4 text-purple-900 flex items-center">
                     <span className="mr-3 text-3xl">🔧</span>
                     {t("Exercise.modificationsLabel")}
                   </h3>
                   <ul className="space-y-3">
                     {selectedExercise.modifications.map((modification, idx) => (
                       <li key={idx} className="flex items-center text-xl text-purple-800">
                         <span className="mr-3 text-2xl">⚙️</span>
                         {modification}
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
               
               <div className="flex flex-col md:flex-row gap-6 pt-6 border-t-4 border-blue-200">
                 <button
                   onClick={() => speakText(createExerciseDescription(selectedExercise), selectedExercise._id)}
                   className="flex-1 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                 >
                   <span className="mr-3 text-2xl">🔊</span>
                   {t("Exercise.readInstructions")}
                 </button>
                 
                 {selectedExercise.videoUrl && (
                   <a
                     href={selectedExercise.videoUrl}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="flex-1 px-8 py-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-center"
                   >
                     <span className="mr-3 text-2xl">▶️</span>
                     {t("Exercise.watchVideo")}
                   </a>
                 )}
               </div>
             </div>
           </div>
         </div>
       </div>
     )}
   </div>
 </div>
);
}

export default Exercise;