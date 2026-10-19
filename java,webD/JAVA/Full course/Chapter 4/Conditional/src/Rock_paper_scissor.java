import java.util.Scanner;
public class Rock_paper_scissor {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.println("Enter Player 1 Action :- ");
        String player1 = sc.nextLine();
        System.out.println("Enter Player 2 action :- ");
        String player2 = sc.nextLine();
        int points1 = 0;
        int points2 = 0;
        if (player1.equals("rock") && player2.equals("rock")) {
            points1 = points1 + 0;
            points2 = points2 + 0;
            System.out.println("Draw");
            System.out.println("points of player 1 :- " + points1);
            System.out.println("points of player 2 :- " + points2);
        } else if (player1.equals("rock") && player2.equals("paper")) {
            points1 = points1 + 0;
            points2 = points2 + 1;
            System.out.println("points of player 1 :- " + points1);
            System.out.println("points of player 2 :- " + points2);
        } else if (player1.equals("paper") && player2.equals("rock")) {
            points1 = points1 + 1;
            points2 = points2 + 0;
            System.out.println("points of player 1 :- " + points1);
            System.out.println("points of player 2 :- " + points2);
        } else if (player1.equals("rock") && player2.equals("scissor")) {
            points1 = points1 + 1;
            points2 = points2 + 0;
            System.out.println("points of player 1 :- " + points1);
            System.out.println("points of player 2 :- " + points2);
        } else if (player1.equals("scissor") && player2.equals("rock")) {
            points1 = points1 + 0;
            points2 = points2 + 1;
            System.out.println("points of player 1 :- " + points1);
            System.out.println("points of player 2 :- " + points2);
        } else if (player1.equals("scissor") && player2.equals("paper")) {
            points1 = points1 + 1;
            points2 = points2 + 0;
            System.out.println("points of player 1 :- " + points1);
            System.out.println("points of player 2 :- " + points2);
        } else if (player1.equals("paper") && player2.equals("scissor")) {
            points1 = points1 + 0;
            points2 = points2 + 1;
            System.out.println("points of player 1 :- " + points1);
            System.out.println("points of player 2 :- " + points2);
        } else if (player1.equals("paper") && player2.equals("paper")) {
            points1 = points1 + 0;
            points2 = points2 + 0;
            System.out.println("points of player 1 :- " + points1);
            System.out.println("points of player 2 :- " + points2);
        } else if (player1.equals("scissor") && player2.equals("scissor")) {
            points1 = points1 + 0;
            points2 = points2 + 0;
            System.out.println("points of player 1 :- " + points1);
            System.out.println("points of player 2 :- " + points2);
        }
    }
}