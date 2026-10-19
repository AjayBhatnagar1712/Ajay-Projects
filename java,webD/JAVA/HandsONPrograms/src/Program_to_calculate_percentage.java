import java.sql.SQLOutput;
import java.util.Scanner;
public class Program_to_calculate_percentage {
    public static void main(String[] args) {
        System.out.println("Calculation Of Class 12 Percentage :- ");
        Scanner sc = new Scanner(System.in);
        System.out.println("Enter Maximum Marks of Subject 1 :- ");
        int a = sc.nextInt();
        System.out.println("Enter Maximum Marks of Subject 2 :- ");
        int b = sc.nextInt();
        System.out.println("Enter Maximum Marks of Subject 3 :- ");
        int c = sc.nextInt();
        System.out.println("Enter Maximum Marks of Subject 4 :- ");
        int d = sc.nextInt();
        System.out.println("Enter Maximum Marks of Subject 5 :- ");
        int e = sc.nextInt();
        int sum = a + b + c + d + e ;
        System.out.println("Total Maximum Marks :- " + sum);
        System.out.println("Enter your Marks of Subject 1 :- ");
        int f = sc.nextInt();
        System.out.println("Enter your Marks of Subject 2 :- ");
        int g = sc.nextInt();
        System.out.println("Enter your Marks of Subject 3 :- ");
        int h = sc.nextInt();
        System.out.println("Enter your Marks of Subject 4 :- ");
        int i = sc.nextInt();
        System.out.println("Enter your Marks of Subject 5 :- ");
        int j = sc.nextInt();
        float sum2 = f + g + h + i + j;
        System.out.println("Total Marks Scored by you :- " + sum2);
        float  percentage = sum2 / sum ;
        float percentage2 = percentage * 100;
        System.out.println("Percentage in 5 Subjects in Boards of class 12th :- " + percentage2);
    }
}
