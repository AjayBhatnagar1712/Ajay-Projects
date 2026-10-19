import java.sql.SQLOutput;
import java.util.Scanner;
public class questions {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        //Q1.Write a program to print numbers from 1 to 10.
        System.out.println("Answer 1 :-");
        for (int a = 1 ; a<=10 ; a++){
            System.out.println(a);
        }
        System.out.println("\n");
        //Q2.Write a program to calculate the sum of first 10 natural number.
        System.out.print("Answers 2 :- ");
        int sum = 0;
        for(int i = 0 ; i<=10 ; i++){
            sum += i ;
        }
        System.out.println("Sum : " + sum);

        System.out.println("\n");
        //Q3.Write a program that prompts the user to input a positive integer. It should then print the multiplication table of that number.
        System.out.println("Answer 3 :- ");
        System.out.println("Input Positive Integer : - ");
        int input = sc.nextInt();
        for (int z = 0 ; z<=10 ; z++){
            int multiplication = input * z ;
            System.out.println(multiplication);
        }
        System.out.println("\n");
        //Write a program to find the factorial value of any number entered through the keyboard.
        System.out.print("Answer 3 :- ");
        int num; // To hold number
        int fact = 1; // To hold factorial

        System.out.print("Enter any positive integer: ");
        num = sc.nextInt();

        for(int i=1; i<=num; i++)
        {
            fact *= i;
        }

        System.out.println("Factorial: "+ fact);
    }
}
