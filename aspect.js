define("dojo/aspect",[], function(){
// summary:
//		dojo/aspect provides aspect oriented programming functionality, allowing for
//		one to add before, around, or after advice on existing methods.
//	description:
//		For example:
//		|	define(["dojo/aspect"], function(aspect){
//		|		var signal = aspect.after(targetObject, "methodName", function(someArgument){
// 		|			this will be called when targetObject.methodName() is called, after the original function is called
//		|		});
//		The returned signal object can be used to cancel the advice. 
//		|	signal.cancel(); // this will stop the advice from being executed anymore
//		|	aspect.before(targetObject, "methodName", function(someArgument){
//		|		// this will be called when targetObject.methodName() is called, before the original function is called
//		|	 });
//	after(target, methodName, advice, receiveArguments):
//		The "after" export of the aspect module is a function that can be used to attach
//		"after" advice to a method. This function will be executed after the original method
//		is executed. By default the function will be called with a single argument, the return
//		value of the original method, or the the return value of the last executed advice (if a previous one exists).
//		The fourth (optional) argument can be set to true to so the function receives the original
// 		arguments (from when the original method was called) rather than the return value.
//		If there are multiple "after" advisors, they are executed in the order they were registered.
//	before(target, methodName, advice);
//		The "before" export of the aspect module is a function that can be used to attach
//		"before" advice to a method. This function will be executed before the original method
//		is executed. This function will be called with the arguments used to call the method.
//		This function may optionally return an array as the new arguments to use to call
//		the original method (or the previous, next-to-execute before advice, if one exists).
//		If the before method doesn't return anything (returns undefined) the original arguments
//		will be preserved.
//		If there are multiple "before" advisors, they are executed in the reverse order they were registered.
//	around(target, methodName, advisor);
//		The "around" export of the aspect module is a function that can be used to attach
//		"around" advice to a method. The advisor function is immediately executed when
// 		the around() is called, is passed a single argument that is a function that can be 
// 		called to continue execution of the original method (or the next around advisor).
// 		The advisor function should return a function, and this function will be called whenever
// 		the method is called. It will be called with the arguments used to call the method.
//		Whatever this function returns will be returned as the result of the method call (unless after advise changes it). 
//		If there are multiple "around" advisors, the most recent one is executed first,
//		which can then delegate to the next one and so on. For example:
//		|	around(obj, "foo", function(originalFoo){
//		|		return function(){
//		|			var start = new Date().getTime();
// 		|			var results = originalFoo.apply(this, arguments); // call the original
// 		|			var end = new Date().getTime();
// 		|			console.log("foo execution took " + (end - start) + " ms");
//		|			return results;
//		|		};
//  	|	});
//	All the advisor functions take these arguments:
//	target:
//		This is the target object
//	methodName:
//		This is the name of the method to attach to.
//	advice:
//		This is function to be called before, after, or around the original method
//		
 	"use strict";
	var undef;
	function advise(dispatcher, type, advice, receiveArguments){
		var previous = dispatcher[type];
		var around = type == "around";
		if(around){
			var advised = advice(function(){
				return previous.advice(this, arguments);
			});
			var signal = {
				cancel: function(){
					signal.cancelled = true;
				},
				advice: function(target, args){
					return signal.cancelled ?
						previous.advice(target, args) : // cancelled, skip to next one
						advised.apply(target, args);	// called the advised function
				}
			};
		}else{
			// create the cancel handler
			var signal = {
				cancel: function(){
					var previous = signal.previous;
					var next = signal.next;
					if(!next && !previous){
						delete dispatcher[type];
					}else{
						if(previous){
							previous.next = next;
						}else{
							dispatcher[type] = next;
						}
						if(next){
							next.previous = previous;
						}
					}
				},
				advice: advice,
				receiveArguments: receiveArguments
			};
		}
		if(previous && !around){
			if(type == "after"){
				// add the listener to the end of the list
				var next = previous;
				while(next){
					previous = next;
					next = next.next;
				}
				previous.next = signal;
				signal.previous = previous;
			}else if(type == "before"){
				// add to beginning
				dispatcher[type] = signal;
				signal.next = previous;
				previous.previous = signal;
			}
		}else{
			// around or first one just replaces
			dispatcher[type] = signal;
		}
		return signal;
	}
	function aspect(type){
		return function(target, methodName, advice, receiveArguments){
			var existing = target[methodName], dispatcher;
			if(!existing || !existing.around){
				// no dispatcher in place
				dispatcher = target[methodName] = function(){
					// before advice
					var args = arguments;
					var before = dispatcher.before;
					while(before){
						args = before.advice.apply(this, args) || args;
						before = before.next;
					}
					// around advice 
					if(typeof dispatcher.around == "object"){
						var results = dispatcher.around.advice(this, args);
					}
					// after advice
					var after = dispatcher.after;
					while(after){
						results = after.receiveArguments ? after.advice.apply(this, args) || results :
								after.advice.call(this, results);
						after = after.next;
					}
					return results;
				};
				target = null; // make sure we don't have cycles for IE
				dispatcher.around = existing ? {advice: function(target, args){
					return existing.apply(target, args);
				}} : "none";
			}
			var results = advise((dispatcher || existing), type, advice, receiveArguments);
			advice = null;
			return results;
		};
	}
	return {
		before: aspect("before"),
		around: aspect("around"),
		after: aspect("after")
	};
});