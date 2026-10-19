import java.util.Scanner;
public class Q5 {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter the number of which you want to find the factorial :- ");
        int num = sc.nextInt();
        int fact = 1;
        for (int i = 1; i <= num ; i++){
            fact *= i;
        }
        System.out.println(fact);
    }
}
