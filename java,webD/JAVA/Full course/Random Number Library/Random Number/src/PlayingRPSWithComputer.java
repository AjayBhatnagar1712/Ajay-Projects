import java.util.Scanner;
import java.util.Random;
public class PlayingRPSWithComputer {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        Random rand = new Random();
        System.out.println("Enter 0 for Rock");
        System.out.println("Enter 1 for Paper");
        System.out.println("Enter 2 for Scissors");
        System.out.print("Enter your action :- ");
        int user = sc.nextInt();
        int computer = rand.nextInt(3);
        System.out.println("Enter your action ");
        int l = 0 ;
        while(i)
        if ( user == 0 && computer == 0 || user == 1 && computer == 1 || user == 2 && computer == 2){
            int point1 = 0;
            int point2 = 0;
            System.out.println("The match is draw");
            System.out.println("Point of player = " + point1);
            System.out.println("Point of computer = " + point2);
        } else if ( user == 0 && computer == 1 || user == 1 && computer == 2 || user == 2 && computer == 0) {
            int point1 = 0;
            int point2 = 1;
            System.out.println("Winner of the match is computer");
            System.out.println("Point of player = " + point1);
            System.out.println("Point of computer = " + point2);
        }else if ( user == 1 && computer == 0 || user == 2 && computer == 1 || user == 0 && computer == 2) {
            int point1 = 1;
            int point2 = 0;
            System.out.println("Winner of the match is player");
            System.out.println("Point of player = " + point1);
            System.out.println("Point of computer = " + point2);
        }else {
            System.out.println("Enter a valid action");
        }
        System.out.println("Computer choose :- " + computer);
    }
}