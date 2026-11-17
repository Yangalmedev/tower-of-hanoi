 :- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_files)).
:- use_module(library(http/http_json)).
:- use_module(library(http/json)).
:- use_module(library(lists)).
:- dynamic game/4, history/1, move_count/1.

:- http_handler(root(.), http_reply_from_files('public', []), [prefix]).
:- http_handler(root(api/new), api_new, [method(post)]).
:- http_handler(root(api/state), api_state, [method(get)]).
:- http_handler(root(api/move), api_move, [method(post)]).
:- http_handler(root(api/undo), api_undo, [method(post)]).
:- http_handler(root(api/solve), api_solve, [method(get)]).

:- initialization(start_server).

start_server :-
    ( game(_,_,_,_) -> true ; reset_game(4) ),
    http_server(http_dispatch, [port(8080)]),
    format('~nTower of Hanoi is running at http://localhost:8080~n', []).

reset_game(N) :-
    retractall(game(_,_,_,_)), retractall(history(_)), retractall(move_count(_)),
    numlist(1, N, Disks),
    assertz(game(N, Disks, [], [])), assertz(history([])), assertz(move_count(0)).

api_new(Request) :-
    http_read_json_dict(Request, Data), N = Data.disks,
    ( integer(N), between(3, 8, N) ->
        reset_game(N), current_state(Dict), reply_json_dict(Dict)
    ; reply_json_dict(_{error:"Choose between 3 and 8 disks"}, [status(400)])
    ).

api_state(_Request) :- current_state(Dict), reply_json_dict(Dict).

api_move(Request) :-
    http_read_json_dict(Request, Data), From = Data.from, To = Data.to,
    ( valid_peg(From), valid_peg(To), From \= To,
      game(N,A,B,C), peg_state(From,A,B,C,Source), peg_state(To,A,B,C,Target),
      Source = [Disk|Rest], (Target = [] ; Target = [Top|_], Disk < Top) ->
        (retract(history(H0)) -> true ; H0=[]),
        assertz(history([snapshot(N,A,B,C)|H0])),
        replace_pegs(From,To,Rest,[Disk|Target],A,B,C,NA,NB,NC),
        retractall(game(_,_,_,_)), assertz(game(N,NA,NB,NC)),
        retract(move_count(M0)), M1 is M0+1, assertz(move_count(M1)),
        current_state(Dict), reply_json_dict(Dict)
    ; reply_json_dict(_{error:"Illegal move. A larger disk cannot sit on a smaller disk."}, [status(400)])
    ).

api_undo(_Request) :-
    ( retract(history([snapshot(N,A,B,C)|Rest])) ->
        assertz(history(Rest)), retractall(game(_,_,_,_)), assertz(game(N,A,B,C)),
        retract(move_count(M0)), M1 is max(0,M0-1), assertz(move_count(M1)),
        current_state(Dict), reply_json_dict(Dict)
    ; reply_json_dict(_{error:"Nothing to undo"}, [status(400)])
    ).

api_solve(_Request) :-
    game(N,_,_,_), hanoi(N,a,c,b,Moves), maplist(move_dict,Moves,JsonMoves),
    reply_json_dict(_{moves:JsonMoves, count: N}).

valid_peg(a). valid_peg(b). valid_peg(c).
peg_state(a,A,_,_,A). peg_state(b,_,B,_,B). peg_state(c,_,_,C,C).
replace_pegs(a,b,NA,NB,_,_,C,NA,NB,C).
replace_pegs(a,c,NA,NC,_,B,_,NA,B,NC).
replace_pegs(b,a,NB,NA,_,_,C,NA,NB,C).
replace_pegs(b,c,NB,NC,A,_,_,A,NB,NC).
replace_pegs(c,a,NC,NA,_,B,_,NA,B,NC).
replace_pegs(c,b,NC,NB,A,_,_,A,NB,NC).
snapshot(snapshot(N,A,B,C)) :- game(N,A,B,C).
current_state(_{disks:N,pegs:_{a:A,b:B,c:C},moves:M,won:Won,minimum:Min}) :-
    game(N,A,B,C), move_count(M), Min is (1 << N)-1,
    length(C, Len), (Len =:= N -> Won=true ; Won=false).
move_dict(move(F,T),_{from:F,to:T}).
hanoi(0,_,_,_,[]) :- !.
hanoi(N,F,T,A,Moves) :-
    N>0, K is N-1, hanoi(K,F,A,T,First),
    hanoi(K,A,T,F,Last), append(First,[move(F,T)|Last],Moves).
