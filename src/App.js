import React, { useState, useEffect, useCallback } from 'react';
import './App.css';


const extractIngredients = (recipeDetails) => {
  const ingredients = [];
  
  
  for (let i = 1; i <= 20; i++) {
    const ingredient = recipeDetails[`strIngredient${i}`];
    const measure = recipeDetails[`strMeasure${i}`];
    
    
    if (ingredient && ingredient.trim()) {
      ingredients.push({
        ingredient: ingredient.trim(),
        measure: (measure || '').trim()
      });
    }
  }
  
  return ingredients;
};


const formatInstructions = (instructions) => {
  if (!instructions) return [];
  
  return instructions
    .split('\n') 
    .filter(step => step.trim()) 
    .map(step => step.trim());
};


const App = () => {

  const [searchQuery, setSearchQuery] = useState(''); 
  const [recipes, setRecipes] = useState([]); 
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState(''); 
  const [hasSearched, setHasSearched] = useState(false); 
  const [selectedRecipe, setSelectedRecipe] = useState(null); 
  const [recipeDetails, setRecipeDetails] = useState(null); 
  const [detailsLoading, setDetailsLoading] = useState(false); 
  const [detailsError, setDetailsError] = useState(''); 


   
  const searchRecipes = useCallback(async (query) => {
    if (!query.trim()) return;

 
    setLoading(true);
    setError('');
    setDetailsError('');
    setHasSearched(true);
    setSelectedRecipe(null);
    setRecipeDetails(null);

  
    const ingredients = query
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    try {
      if (ingredients.length === 1) {
    
        const response = await fetch(
          `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ingredients[0])}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.meals) {
          setRecipes(data.meals);
        } else {
          setRecipes([]);
          setError(`No recipes found with "${query}". Try another ingredient like chicken, tomato, or pasta!`);
        }
      } else {
      
        const fetches = ingredients.map(ing =>
          fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ing)}`)
            .then(res => {
              if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
              return res.json();
            })
        );

        const results = await Promise.all(fetches);

        if (results.some(r => !r.meals)) {
          setRecipes([]);
          setError(`No recipes found that match all ingredients: "${ingredients.join(', ')}".`);
        } else {
     
          const idSets = results.map(r => new Set(r.meals.map(m => m.idMeal)));
          const firstList = results[0].meals;
          const commonIds = firstList
            .map(m => m.idMeal)
            .filter(id => idSets.every(s => s.has(id)));

        
          const mealMap = new Map(firstList.map(m => [m.idMeal, m]));
          const intersected = commonIds.map(id => {
            if (mealMap.has(id)) return mealMap.get(id);
           
            for (const r of results) {
              const found = r.meals.find(m => m.idMeal === id);
              if (found) return found;
            }
            return null;
          }).filter(Boolean);

          if (intersected.length > 0) {
            setRecipes(intersected);
          } else {
            setRecipes([]);
            setError(`No recipes found that match all ingredients: "${ingredients.join(', ')}".`);
          }
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(
        err.name === 'TypeError'
          ? 'Network error: Please check your internet connection and try again.'
          : 'Sorry, we encountered an error while searching. Please try again in a moment.'
      );
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, []);


  const fetchRecipeDetails = useCallback(async (recipeId) => {
    if (!recipeId) return;
    
    setDetailsLoading(true);
    setDetailsError('');
    
    try {
      const response = await fetch(
        `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${recipeId}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.meals?.[0]) {
        setRecipeDetails(data.meals[0]);
      } else {
        throw new Error('Recipe details not found');
      }
    } catch (err) {
      console.error('Details fetch error:', err);
      setDetailsError(
        err.name === 'TypeError'
          ? 'Unable to load recipe details. Please check your connection.'
          : 'Sorry, we couldn\'t load the recipe details. Please try again.'
      );
      setRecipeDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

 
  const handleRecipeClick = useCallback(async (recipe) => {
    setSelectedRecipe(recipe);
    setRecipeDetails(null);
    await fetchRecipeDetails(recipe.idMeal);
  }, [fetchRecipeDetails]);


  const closeModal = useCallback(() => {
    setSelectedRecipe(null);
    setRecipeDetails(null);
    setDetailsError('');
  }, []);

 
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && selectedRecipe) {
        closeModal();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedRecipe, closeModal]);

  
  const handleSubmit = (e) => {
    e.preventDefault();
    searchRecipes(searchQuery);
  };

 
  const handleSearchAgain = () => {
    setSearchQuery('');
    setRecipes([]);
    setError('');
    setHasSearched(false);
    setSelectedRecipe(null);
    setRecipeDetails(null);
    setDetailsError('');
  };

  
  const handleSuggestionClick = (ingredient) => {
    setSearchQuery(ingredient);
    searchRecipes(ingredient);
  };

  return (
    <div className="app">
     
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">🍳 Recipe Finder</h1>
          <p className="app-subtitle">Quick recipes for busy people</p>
          
          <form onSubmit={handleSubmit} className="search-form">
            <div className="search-container">
              <div className="input-wrapper">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="What ingredient do you have? (chicken, tomato, rice...)"
                  className="search-input"
                  disabled={loading}
                  aria-label="Search for recipes by ingredient"
                />
                <span className="search-icon" aria-hidden="true">🔍</span>
              </div>
              <button 
                type="submit" 
                className="search-button"
                disabled={loading || !searchQuery.trim()}
                aria-label={loading ? 'Searching recipes' : 'Search recipes'}
              >
                {loading ? (
                  <>
                    <span className="spinner" aria-hidden="true"></span>
                    Searching...
                  </>
                ) : (
                  'Find Recipes'
                )}
              </button>
            </div>
          </form>
        </div>
      </header>

      
      <main className="main-content">
        
        {loading && (
          <div className="state-container" aria-live="polite" aria-busy="true">
            <div className="loading-spinner"></div>
            <p className="loading-text">Searching for recipes with "{searchQuery}"...</p>
          </div>
        )}
        
       
        {error && (
          <div className="state-container" aria-live="polite">
            <div className="error-icon">😕</div>
            <h3 className="error-title">No recipes found</h3>
            <p className="error-message">{error}</p>
            <button 
              className="retry-button" 
              onClick={handleSearchAgain}
              aria-label="Try another ingredient"
            >
              Try Another Ingredient
            </button>
          </div>
        )}
        
        {/* Results Grid */}
        {!loading && !error && recipes.length > 0 && (
          <section className="recipes-section" aria-live="polite">
            <div className="section-header">
              <h2 className="results-title">
                Found {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} with "{searchQuery}"
              </h2>
              <button 
                className="clear-button" 
                onClick={handleSearchAgain}
                aria-label="Start new search"
              >
                New Search
              </button>
            </div>
            <div className="recipes-grid">
              {recipes.map((recipe) => (
                <article 
                  key={recipe.idMeal} 
                  className="recipe-card"
                  onClick={() => handleRecipeClick(recipe)}
                  tabIndex={0}
                  onKeyPress={(e) => e.key === 'Enter' && handleRecipeClick(recipe)}
                  role="button"
                  aria-label={`View recipe for ${recipe.strMeal}`}
                >
                  <div className="card-image">
                    <img 
                      src={recipe.strMealThumb} 
                      alt={recipe.strMeal}
                      loading="lazy"
                    />
                  </div>
                  <div className="card-content">
                    <h3 className="recipe-title">{recipe.strMeal}</h3>
                    <div className="view-recipe-button" aria-hidden="true">
                      View Recipe →
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        
        {/* Empty State - Before Search */}
        {!loading && !error && !hasSearched && (
          <div className="state-container">
            <div className="welcome-icon">👨‍🍳</div>
            <h3 className="welcome-title">Welcome, Taylor!</h3>
            <p className="welcome-message">
              Enter an ingredient you have to find delicious recipes quickly.
            </p>
            <div className="suggestions">
              {['chicken', 'tomato', 'pasta', 'rice'].map((ingredient) => (
                <button
                  key={ingredient}
                  className="suggestion-tag"
                  onClick={() => handleSuggestionClick(ingredient)}
                  type="button"
                >
                  {ingredient}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <div 
          className="modal-overlay" 
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="modal-header">
              <h2 id="modal-title" className="modal-title">
                {recipeDetails ? recipeDetails.strMeal : selectedRecipe.strMeal}
              </h2>
              <button 
                className="modal-close"
                onClick={closeModal}
                aria-label="Close recipe details"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body">
              {detailsLoading ? (
                <div className="modal-loading" aria-live="polite" aria-busy="true">
                  <div className="loading-spinner"></div>
                  <p>Loading recipe details...</p>
                </div>
              ) : detailsError ? (
                <div className="modal-error" aria-live="polite">
                  <div className="error-icon">⚠️</div>
                  <h3>Unable to Load Recipe</h3>
                  <p>{detailsError}</p>
                  <button 
                    className="retry-button"
                    onClick={() => fetchRecipeDetails(selectedRecipe.idMeal)}
                  >
                    Try Again
                  </button>
                </div>
              ) : recipeDetails ? (
                <div className="recipe-details">
                  {/* Recipe Image and Basic Info */}
                  <div className="recipe-hero">
                    <img 
                      src={recipeDetails.strMealThumb} 
                      alt={recipeDetails.strMeal}
                      className="recipe-detail-image"
                    />
                    <div className="recipe-meta">
                      {recipeDetails.strArea && (
                        <div className="meta-item">
                          <span className="meta-label">Cuisine:</span>
                          <span className="meta-value">{recipeDetails.strArea}</span>
                        </div>
                      )}
                      {recipeDetails.strCategory && (
                        <div className="meta-item">
                          <span className="meta-label">Category:</span>
                          <span className="meta-value">{recipeDetails.strCategory}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ingredients Section */}
                  <section className="ingredients-section" aria-labelledby="ingredients-title">
                    <h3 id="ingredients-title" className="section-title">Ingredients</h3>
                    <div className="ingredients-grid">
                      {extractIngredients(recipeDetails).map((item, index) => (
                        <div key={index} className="ingredient-item">
                          <span className="ingredient-measure">{item.measure}</span>
                          <span className="ingredient-name">{item.ingredient}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Instructions Section */}
                  <section className="instructions-section" aria-labelledby="instructions-title">
                    <h3 id="instructions-title" className="section-title">Instructions</h3>
                    <div className="instructions">
                      {formatInstructions(recipeDetails.strInstructions).map((step, index) => (
                        <div key={index} className="instruction-step">
                          <span className="step-number">{index + 1}</span>
                          <p className="step-text">{step}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Video Link */}
                  {recipeDetails.strYoutube && (
                    <section className="video-section" aria-labelledby="video-title">
                      <h3 id="video-title" className="section-title">Video Tutorial</h3>
                      <a 
                        href={recipeDetails.strYoutube} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="video-link"
                      >
                        📺 Watch on YouTube
                      </a>
                    </section>
                  )}
                </div>
              ) : null}
            </div>

            {/* Modal Footer with Close Button */}
            <div className="modal-footer">
              <button 
                className="close-button"
                onClick={closeModal}
              >
                Close Recipe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;